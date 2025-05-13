/**
 * 加密系统配置
 * 此文件包含客户端和服务器端共享的加密配置
 */

// AES加密相关常量
export const IV_LENGTH = 16;
export const SERVER_AES_KEY = "defaultServerKey12";  // 仅用于演示，生产环境应使用更强的密钥

// 协议常量
export const PROTOCOL_VERSION = 1;
export const ENCRYPTED_AES_KEY_SIZE_LENGTH = 4; 