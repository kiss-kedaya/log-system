import json
import requests
import os
import struct
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.serialization import load_pem_public_key
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend


class HybridCryptoClient:
    def __init__(self, api_url):
        self.api_url = api_url
        self.public_key = None
        self.protocol_version = 1
        self.iv_length = 16

    def set_public_key(self, public_key_pem):
        """直接设置RSA公钥"""
        self.public_key = public_key_pem
        return True

    def encrypt_data(self, data):
        """使用混合加密方式加密数据"""
        if not self.public_key:
            raise Exception("未设置RSA公钥，请先设置公钥")

        # 将数据转换为JSON字符串
        json_str = json.dumps(data) if not isinstance(data, str) else data
        json_bytes = json_str.encode("utf-8")

        # 生成随机AES密钥 (32字节/256位)
        aes_key = os.urandom(32)

        # 生成随机IV (16字节)
        iv = os.urandom(self.iv_length)

        # 使用AES加密数据
        cipher = Cipher(
            algorithms.AES(aes_key), modes.CBC(iv), backend=default_backend()
        )
        encryptor = cipher.encryptor()

        # 添加PKCS7填充
        padding_length = 16 - (len(json_bytes) % 16)
        padded_data = json_bytes + bytes([padding_length] * padding_length)

        # 加密数据
        encrypted_content = encryptor.update(padded_data) + encryptor.finalize()

        # 使用RSA公钥加密AES密钥
        public_key_obj = load_pem_public_key(self.public_key.encode("utf-8"))
        encrypted_aes_key = public_key_obj.encrypt(
            aes_key,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None,
            ),
        )

        # 创建完整的加密数据包
        # 格式：加密密钥 + IV(16字节) + 加密数据
        result_buffer = encrypted_aes_key + iv + encrypted_content

        return result_buffer

    def submit_log(self, log_data):
        """提交加密的日志数据到服务器"""
        try:
            # 加密日志数据
            encrypted_data = self.encrypt_data(log_data)

            # 发送到服务器
            headers = {"Content-Type": "application/octet-stream"}
            response = requests.post(
                f"{self.api_url}/api/logs", data=encrypted_data, headers=headers
            )

            if response.status_code not in [200, 201, 202, 204]:  # 所有可能的成功状态码
                raise Exception(
                    f"提交日志失败: 服务器响应状态码 {response.status_code}"
                )

            return response

        except Exception as e:
            print(f"提交日志失败: {str(e)}")
            raise


# 使用示例（使用提供的公钥）
if __name__ == "__main__":
    client = HybridCryptoClient("https://www.apil.top")

    # 设置公钥
    public_key = """-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAq2WaokfHsqGFoS8XAhSo
pemkt5BDuOgG3HN8BvGFCtCjOMRaS/fvERel/pPjkBk0GK+Mx+VL/Uu8Dg1VAGWi
uNfJeu3ra3HBtQTFTwVHlXcooFe1yM68qeh4GeKQN3kowRKMztOCtNcluRSOgy8N
oCGLDx/ymAjRm2KFZiyrlC+Xb30eFFwx98nWVmfOZ9IATMu7cV/Pj3R3qGs8fnyk
srfg7V84J0dELd9EKfID9VoC3EuCD14VT+gZQcwK/XDvGU3sSZpRORZtDOhX22B6
WA2QPeaEmb8abXaPiP96jUU6k2GXo4LDb2zMDM7VqmV/Lmwyt2kjpisegauNTvW7
uQIDAQAB
-----END PUBLIC KEY-----"""
    client.set_public_key(public_key)

    # 准备日志数据
    log_data = {
        "event": "user_login",
        "user_id": 12345,
        "timestamp": "2023-06-15T12:34:56Z",
        "ip_address": "192.168.1.1",
        "browser": "Chrome/98.0.4758.102",
    }

    # 提交日志
    try:
        result = client.submit_log(log_data)
        print("日志提交成功:", result.status_code)
    except Exception as e:
        print(f"日志提交失败: {str(e)}")
