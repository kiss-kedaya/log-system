import json
import requests
import os
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.serialization import load_pem_public_key
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend


class HybridCryptoClient:
    def __init__(self, api_url):
        """
        初始化混合加密客户端

        参数:
            api_url: API服务器的基础URL
        """
        self.api_url = api_url
        self.public_key = None  # 用于存储RSA公钥
        self.iv_length = 16  # 初始化向量长度(16字节)

    def set_public_key(self, public_key_pem):
        """
        直接设置RSA公钥

        参数:
            public_key_pem: PEM格式的RSA公钥

        返回值:
            成功设置返回True
        """
        self.public_key = public_key_pem
        return True

    def encrypt_data(self, data):
        """
        使用混合加密方式加密数据 (RSA + AES)

        混合加密流程:
        1. 使用随机生成的AES密钥加密实际数据
        2. 使用RSA公钥加密AES密钥
        3. 将加密后的AES密钥、IV和加密数据组合成完整的加密包

        参数:
            data: 要加密的数据，可以是字典或字符串

        返回值:
            bytes类型的加密数据包

        异常:
            如果未设置公钥，则抛出异常
        """
        if not self.public_key:
            raise Exception("未设置RSA公钥，请先设置公钥")

        # 第1步: 数据预处理 - 将数据转换为JSON字符串并编码为字节
        json_str = json.dumps(data) if not isinstance(data, str) else data
        json_bytes = json_str.encode("utf-8")

        # 第2步: 生成加密所需的随机密钥和初始化向量
        # 生成随机AES密钥 (32字节/256位) - 用于实际加密数据
        aes_key = os.urandom(32)  # 使用操作系统的随机源生成高质量随机数

        # 生成随机IV (16字节) - 确保相同明文每次加密结果不同
        iv = os.urandom(self.iv_length)  # CBC模式需要初始化向量

        # 第3步: 使用AES-256-CBC模式加密数据
        # 创建AES加密器对象
        cipher = Cipher(
            algorithms.AES(aes_key),  # 指定AES算法和密钥
            modes.CBC(iv),  # 指定CBC模式和初始化向量
            backend=default_backend(),  # 使用默认后端
        )
        encryptor = cipher.encryptor()

        # 第4步: 添加PKCS7填充
        # AES需要数据长度是16字节的倍数，因此需要填充
        padding_length = 16 - (len(json_bytes) % 16)  # 计算需要填充的字节数
        # 填充规则: 填充字节的值等于填充的字节数
        padded_data = json_bytes + bytes([padding_length] * padding_length)

        # 第5步: 执行AES加密操作
        # 加密填充后的数据
        encrypted_content = encryptor.update(padded_data) + encryptor.finalize()

        # 第6步: 使用RSA公钥加密AES密钥
        # 这样只有拥有RSA私钥的接收方才能解密AES密钥
        public_key_obj = load_pem_public_key(
            self.public_key.encode("utf-8")
        )  # 加载PEM格式公钥
        encrypted_aes_key = public_key_obj.encrypt(
            aes_key,  # 要加密的AES密钥
            padding.OAEP(  # 使用OAEP填充方案增强安全性
                mgf=padding.MGF1(algorithm=hashes.SHA256()),  # 掩码生成函数
                algorithm=hashes.SHA256(),  # 哈希算法
                label=None,  # 不使用标签
            ),
        )
        # 第7步: 创建完整的加密数据包
        # 格式: [加密后的AES密钥] + [IV(16字节)] + [加密后的数据]
        # 接收方需要按照这个格式解析并分别处理各部分
        result_buffer = encrypted_aes_key + iv + encrypted_content

        return result_buffer

    def submit_log(self, log_data):
        """
        提交加密的日志数据到服务器

        参数:
            log_data: 要提交的日志数据

        返回值:
            服务器响应对象

        异常:
            如果提交失败，抛出异常
        """
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
    # 创建客户端实例
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
