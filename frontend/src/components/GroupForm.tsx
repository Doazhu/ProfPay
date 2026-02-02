import { useState, useEffect } from 'react';
import { Faculty, StudentGroup, GroupCreate } from '../types';
import { facultyApi } from '../services/api';

interface GroupFormProps {
  group?: StudentGroup;
  onSubmit: (data: GroupCreate) => Promise<void>;
  onCancel: () => void;
}

export default function GroupForm({ group, onSubmit, onCancel }: GroupFormProps) {
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<GroupCreate>({
    name: group?.name || '',
    faculty_id: group?.faculty_id || 0,
    course: group?.course || undefined,
  });

  useEffect(() => {
    loadFaculties();
  }, []);

  const loadFaculties = async () => {
    try {
      const data = await facultyApi.getAll(true);
      setFaculties(data);
      
      // Set first faculty as default if creating new group
      if (!group && data.length > 0 && formData.faculty_id === 0) {
        setFormData(prev => ({ ...prev, faculty_id: data[0].id }));
      }
    } catch (err) {
      console.error('Failed to load faculties:', err);
      setError('Не удалось загрузить список факультетов');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Введите название группы');
      return;
    }
    
    if (!formData.faculty_id || formData.faculty_id === 0) {
      setError('Выберите факультет');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onSubmit(formData);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка при сохранении группы');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
          Название группы <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Например: ИВТ-21"
          required
        />
      </div>

      <div>
        <label htmlFor="faculty_id" className="block text-sm font-medium text-gray-700 mb-1">
          Факультет <span className="text-red-500">*</span>
        </label>
        <select
          id="faculty_id"
          value={formData.faculty_id}
          onChange={(e) => setFormData({ ...formData, faculty_id: parseInt(e.target.value) })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        >
          <option value={0}>Выберите факультет</option>
          {faculties.map((faculty) => (
            <option key={faculty.id} value={faculty.id}>
              {faculty.short_name ? `${faculty.short_name} - ${faculty.name}` : faculty.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="course" className="block text-sm font-medium text-gray-700 mb-1">
          Курс (опционально)
        </label>
        <select
          id="course"
          value={formData.course || ''}
          onChange={(e) => setFormData({ ...formData, course: e.target.value ? parseInt(e.target.value) : undefined })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Не указан</option>
          {[1, 2, 3, 4, 5, 6].map((c) => (
            <option key={c} value={c}>{c} курс</option>
          ))}
        </select>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Сохранение...' : group ? 'Обновить' : 'Создать'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 disabled:cursor-not-allowed"
        >
          Отмена
        </button>
      </div>
    </form>
  );
}
