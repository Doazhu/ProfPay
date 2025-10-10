from fastapi import APIRouter, Depends
from backend.application.user_service import UserService, UserCreateDTO
from backend.domain.user import IUserRepository
from backend.infrastructure.user_repository_postgres import UserRepositoryPostgres

router = APIRouter()

# Зависимость для репозитория (для инъекции)
def get_user_repository() -> IUserRepository:
    # В реальном приложении здесь будет создаваться сессия БД и передаваться в репозиторий
    return UserRepositoryPostgres(db_session=None) # type: ignore

# Зависимость для сервиса приложения
def get_user_service(user_repository: IUserRepository = Depends(get_user_repository)) -> UserService:
    return UserService(user_repository)

@router.post("/users/")
async def create_user_endpoint(user_data: UserCreateDTO, user_service: UserService = Depends(get_user_service)):
    result = user_service.create_user(user_data)
    return result
