from typing import List

# Пример DTO (Data Transfer Object)
class UserCreateDTO:
    username: str
    email: str

# Пример сервиса приложения
class UserService:
    def __init__(self, user_repository):
        self.user_repository = user_repository

    def create_user(self, user_dto: UserCreateDTO):
        # Здесь будет логика вызова доменного слоя
        print(f"Creating user: {user_dto.username}, {user_dto.email}")
        # user = self.user_repository.save(User(username=user_dto.username, email=user_dto.email))
        # return UserDTO.from_entity(user)
        return {"message": "User created successfully (placeholder)"}
