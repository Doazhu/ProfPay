from backend.domain.user import IUserRepository, User

# Пример реализации репозитория для PostgreSQL
class UserRepositoryPostgres(IUserRepository):
    def __init__(self, db_session):
        self.db_session = db_session

    def get_by_id(self, user_id: str) -> User:
        print(f"Fetching user {user_id} from PostgreSQL (placeholder)")
        # Здесь будет реальная логика запроса к БД
        return User(id=user_id, username="testuser", email="test@example.com")

    def save(self, user: User) -> User:
        print(f"Saving user {user.username} to PostgreSQL (placeholder)")
        # Здесь будет реальная логика сохранения в БД
        return user
