from abc import ABC, abstractmethod

# Пример сущности домена
class User:
    def __init__(self, id: str, username: str, email: str):
        self.id = id
        self.username = username
        self.email = email

    def update_email(self, new_email: str):
        if "@" not in new_email:
            raise ValueError("Invalid email format")
        self.email = new_email

# Пример интерфейса репозитория (абстракция)
class IUserRepository(ABC):
    @abstractmethod
    def get_by_id(self, user_id: str) -> User:
        pass

    @abstractmethod
    def save(self, user: User) -> User:
        pass
