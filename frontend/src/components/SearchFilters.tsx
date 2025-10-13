import React from 'react';
import type { FilterState } from '../types';

interface SearchFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onExport?: (format: 'pdf' | 'csv') => void;
}

const SearchFilters: React.FC<SearchFiltersProps> = ({ filters, onFiltersChange, onExport }) => {
  const handleSearchChange = (search: string) => {
    onFiltersChange({ ...filters, search });
  };

  const handleStatusChange = (status: FilterState['status']) => {
    onFiltersChange({ ...filters, status });
  };

  const handleContactTypeChange = (contactType: FilterState['contactType']) => {
    onFiltersChange({ ...filters, contactType });
  };

  return (
    <div className="bg-white p-4 border-b border-gray-200">
      <div className="flex flex-wrap items-center gap-4">
        {/* Поиск */}
        <div className="flex-1 min-w-64">
          <input
            type="text"
            placeholder="Поиск по имени..."
            value={filters.search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-custom focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
          />
        </div>

        {/* Фильтр по статусу */}
        <select
          value={filters.status}
          onChange={(e) => handleStatusChange(e.target.value as FilterState['status'])}
          className="px-4 py-2 border border-gray-300 rounded-custom focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="all">Все статусы</option>
          <option value="paid">Оплачено</option>
          <option value="debt">Долг</option>
          <option value="partial">Частично</option>
        </select>

        {/* Фильтр по типу контакта */}
        <select
          value={filters.contactType}
          onChange={(e) => handleContactTypeChange(e.target.value as FilterState['contactType'])}
          className="px-4 py-2 border border-gray-300 rounded-custom focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="all">Все контакты</option>
          <option value="telegram">Telegram</option>
          <option value="vk">VK</option>
        </select>

        {/* Диапазон дат */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={filters.dateFrom || ''}
            onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-custom focus:outline-none focus:ring-2 focus:ring-accent text-sm"
          />
          <span className="text-gray-500">—</span>
          <input
            type="date"
            value={filters.dateTo || ''}
            onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-custom focus:outline-none focus:ring-2 focus:ring-accent text-sm"
          />
        </div>

        {/* Кнопки экспорта */}
        {onExport && (
          <div className="flex gap-2">
            <button
              onClick={() => onExport('csv')}
              className="px-4 py-2 bg-accent text-white rounded-custom hover:bg-accent-solid transition-colors duration-200 text-sm"
            >
              CSV
            </button>
            <button
              onClick={() => onExport('pdf')}
              className="px-4 py-2 bg-accent text-white rounded-custom hover:bg-accent-solid transition-colors duration-200 text-sm"
            >
              PDF
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchFilters;