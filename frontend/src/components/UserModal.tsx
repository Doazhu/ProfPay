import React from 'react';
import type { User } from '../types';

interface UserModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (user: User) => void;
  onRemind?: (userId: string) => void;
  canEdit?: boolean;
}

const UserModal: React.FC<UserModalProps> = ({
  user,
  isOpen,
  onClose,
  onEdit,
  onRemind,
  canEdit = false,
}) => {
  if (!isOpen || !user) return null;

  const getStatusColor = (status: User['status']) => {
    switch (status) {
      case 'paid': return 'text-green-600 bg-green-50';
      case 'debt': return 'text-red-600 bg-red-50';
      case 'partial': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusText = (status: User['status']) => {
    switch (status) {
      case 'paid': return 'Оплачено';
      case 'debt': return 'Долг';
      case 'partial': return 'Частично';
      default: return 'Неизвестно';
    }
  };

  const totalPaid = user.paymentHistory
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-custom max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-hover">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{user.fullName}</h2>
              <div className="mt-2">
                <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(user.status)}`}>
                  {getStatusText(user.status)}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Контактная информация */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Контакты</h3>
            <div className="space-y-2">
              {user.contact.telegram && (
                <div className="flex items-center gap-2">
                  <span className="text-blue-600">📱</span>
                  <a
                    href={`https://t.me/${user.contact.telegram}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800"
                  >
                    @{user.contact.telegram}
                  </a>
                </div>
              )}
              {user.contact.vk && (
                <div className="flex items-center gap-2">
                  <span className="text-blue-600">🌐</span>
                  <a
                    href={`https://vk.com/${user.contact.vk}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800"
                  >
                    vk.com/{user.contact.vk}
                  </a>
                </div>
              )}
              {!user.contact.telegram && !user.contact.vk && (
                <p className="text-gray-500">Контакты не указаны</p>
              )}
            </div>
          </div>

          {/* Статистика платежей */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Статистика</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-custom">
                <div className="text-sm text-gray-600">Всего оплачено</div>
                <div className="text-xl font-semibold text-gray-900">{totalPaid} ₽</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-custom">
                <div className="text-sm text-gray-600">Количество платежей</div>
                <div className="text-xl font-semibold text-gray-900">
                  {user.paymentHistory.filter(p => p.status === 'completed').length}
                </div>
              </div>
            </div>
          </div>

          {/* История платежей */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">История платежей</h3>
            {user.paymentHistory.length > 0 ? (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {user.paymentHistory.map((payment) => (
                  <div key={payment.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-custom">
                    <div>
                      <div className="font-medium">{payment.amount} ₽</div>
                      <div className="text-sm text-gray-600">
                        {new Date(payment.date).toLocaleDateString('ru-RU')}
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      payment.status === 'completed' ? 'bg-green-100 text-green-800' :
                      payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {payment.status === 'completed' ? 'Завершен' :
                       payment.status === 'pending' ? 'В обработке' : 'Отклонен'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">Нет истории платежей</p>
            )}
          </div>
        </div>

        {/* Действия */}
        <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
          {onRemind && (
            <button
              onClick={() => onRemind(user.id)}
              className="px-4 py-2 bg-yellow-500 text-white rounded-custom hover:bg-yellow-600 transition-colors duration-200"
            >
              Отправить напоминание
            </button>
          )}
          {canEdit && onEdit && (
            <button
              onClick={() => onEdit(user)}
              className="px-4 py-2 bg-accent text-white rounded-custom hover:bg-accent-solid transition-colors duration-200"
            >
              Редактировать
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded-custom hover:bg-gray-600 transition-colors duration-200"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserModal;