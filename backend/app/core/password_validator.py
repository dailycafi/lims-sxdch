"""密码验证工具"""
import re
from typing import Tuple, List


class PasswordValidator:
    """
    密码验证器，实现密码强度规则：
    1. 不能包含用户的帐户名
    2. 至少包含四类字符中的三类字符：
       - 英文大写字母(A 到 Z)
       - 英文小写字母(a 到 z)
       - 10 个数字(0 到 9)
       - 非字母字符(例如 !、$、#、%)
    3. 不能包含帐户名中超过两个连续字符的部分
    4. 至少有六个字符长
    """
    
    MIN_LENGTH = 6
    MIN_CHAR_TYPES = 3
    MAX_CONSECUTIVE_USERNAME_CHARS = 2
    
    @staticmethod
    def validate(password: str, username: str) -> Tuple[bool, List[str]]:
        """
        验证密码是否符合要求
        
        Args:
            password: 要验证的密码
            username: 用户名
            
        Returns:
            (是否有效, 错误消息列表)
        """
        errors = []
        
        # 规则1: 检查长度
        if len(password) < PasswordValidator.MIN_LENGTH:
            errors.append(f"密码长度至少为{PasswordValidator.MIN_LENGTH}个字符")
        
        # 规则2: 检查字符类型
        char_types = 0
        if re.search(r'[A-Z]', password):
            char_types += 1
        if re.search(r'[a-z]', password):
            char_types += 1
        if re.search(r'[0-9]', password):
            char_types += 1
        if re.search(r'[^A-Za-z0-9]', password):
            char_types += 1
        
        if char_types < PasswordValidator.MIN_CHAR_TYPES:
            errors.append(
                f"密码必须包含至少{PasswordValidator.MIN_CHAR_TYPES}种字符类型"
                "（大写字母、小写字母、数字、特殊字符）"
            )
        
        # 规则3: 不能包含用户名
        if username.lower() in password.lower():
            errors.append("密码不能包含用户名")
        
        # 规则4: 不能包含用户名中超过两个连续字符
        username_lower = username.lower()
        password_lower = password.lower()
        
        for i in range(len(username_lower) - PasswordValidator.MAX_CONSECUTIVE_USERNAME_CHARS):
            substring = username_lower[i:i + PasswordValidator.MAX_CONSECUTIVE_USERNAME_CHARS + 1]
            if substring in password_lower:
                errors.append(
                    f"密码不能包含用户名中超过{PasswordValidator.MAX_CONSECUTIVE_USERNAME_CHARS}个连续字符"
                )
                break
        
        return len(errors) == 0, errors
    
    @staticmethod
    def get_requirements() -> List[str]:
        """获取密码要求说明"""
        return [
            f"至少{PasswordValidator.MIN_LENGTH}个字符",
            f"至少包含{PasswordValidator.MIN_CHAR_TYPES}种字符类型（大写字母、小写字母、数字、特殊字符）",
            "不能包含用户名",
            f"不能包含用户名中超过{PasswordValidator.MAX_CONSECUTIVE_USERNAME_CHARS}个连续字符"
        ]

