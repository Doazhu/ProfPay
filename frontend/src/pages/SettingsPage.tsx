import { useEffect, useState } from 'react';
import type { Faculty, StudentGroup, User } from '../types';
import { facultyApi, groupApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function SettingsPage() {
  const { isAdmin } = useAuth();
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [selectedFacultyId, setSelectedFacultyId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // New faculty form
  const [newFacultyName, setNewFacultyName] = useState('');
  const [newFacultyShort, setNewFacultyShort] = useState('');

  // New group form
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupCourse, setNewGroupCourse] = useState(1);

  useEffect(() => {
    loadFaculties();
  }, []);

  useEffect(() => {
    if (selectedFacultyId) {
      loadGroups(selectedFacultyId);
    }
  }, [selectedFacultyId]);

  const loadFaculties = async () => {
    try {
      const data = await facultyApi.getAll(false);
      setFaculties(data);
      if (data.length > 0 && !selectedFacultyId) {
        setSelectedFacultyId(data[0].id);
      }
    } catch (error) {
      console.error('Failed to load faculties:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadGroups = async (facultyId: number) => {
    try {
      const data = await groupApi.getAll(facultyId, false);
      setGroups(data);
    } catch (error) {
      console.error('Failed to load groups:', error);
    }
  };

  const handleAddFaculty = async () => {
    if (!newFacultyName.trim()) return;

    try {
      await facultyApi.create({
        name: newFacultyName,
        short_name: newFacultyShort || undefined,
      });
      setNewFacultyName('');
      setNewFacultyShort('');
      loadFaculties();
    } catch (error) {
      console.error('Failed to create faculty:', error);
    }
  };

  const handleAddGroup = async () => {
    if (!newGroupName.trim() || !selectedFacultyId) return;

    try {
      await groupApi.create({
        name: newGroupName,
        faculty_id: selectedFacultyId,
        course: newGroupCourse,
      });
      setNewGroupName('');
      setNewGroupCourse(1);
      loadGroups(selectedFacultyId);
    } catch (error) {
      console.error('Failed to create group:', error);
    }
  };

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <svg className="w-16 h-16 mx-auto text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <p className="text-lg font-medium text-dark">Доступ запрещён</p>
        <p className="text-accent mt-1">Эта страница доступна только администраторам</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark">Настройки системы</h1>
        <p className="text-accent mt-1">Управление справочниками</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Faculties */}
        <div className="card">
          <h2 className="text-lg font-semibold text-dark mb-4">Факультеты</h2>

          {/* Add Faculty Form */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newFacultyName}
              onChange={(e) => setNewFacultyName(e.target.value)}
              placeholder="Название факультета"
              className="input flex-1"
            />
            <input
              type="text"
              value={newFacultyShort}
              onChange={(e) => setNewFacultyShort(e.target.value)}
              placeholder="Сокр."
              className="input w-20"
            />
            <button
              onClick={handleAddFaculty}
              className="btn-primary px-4"
            >
              +
            </button>
          </div>

          {/* Faculty List */}
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {faculties.map((faculty) => (
              <div
                key={faculty.id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedFacultyId === faculty.id
                    ? 'border-primary bg-primary/5'
                    : 'border-light-dark hover:bg-light-dark/50'
                }`}
                onClick={() => setSelectedFacultyId(faculty.id)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-dark">{faculty.name}</p>
                    {faculty.short_name && (
                      <p className="text-sm text-accent">{faculty.short_name}</p>
                    )}
                  </div>
                  <span className={`text-xs ${faculty.is_active ? 'text-green-600' : 'text-red-600'}`}>
                    {faculty.is_active ? 'Активен' : 'Неактивен'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Groups */}
        <div className="card">
          <h2 className="text-lg font-semibold text-dark mb-4">
            Группы
            {selectedFacultyId && (
              <span className="text-sm font-normal text-accent ml-2">
                ({faculties.find(f => f.id === selectedFacultyId)?.short_name})
              </span>
            )}
          </h2>

          {selectedFacultyId ? (
            <>
              {/* Add Group Form */}
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Название группы"
                  className="input flex-1"
                />
                <select
                  value={newGroupCourse}
                  onChange={(e) => setNewGroupCourse(Number(e.target.value))}
                  className="input w-24"
                >
                  {[1, 2, 3, 4, 5, 6].map((c) => (
                    <option key={c} value={c}>{c} курс</option>
                  ))}
                </select>
                <button
                  onClick={handleAddGroup}
                  className="btn-primary px-4"
                >
                  +
                </button>
              </div>

              {/* Group List */}
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {groups.length === 0 ? (
                  <p className="text-center text-accent py-4">
                    Нет групп для этого факультета
                  </p>
                ) : (
                  groups.map((group) => (
                    <div
                      key={group.id}
                      className="p-3 rounded-lg border border-light-dark hover:bg-light-dark/50"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-dark">{group.name}</p>
                          <p className="text-sm text-accent">{group.course} курс</p>
                        </div>
                        <span className={`text-xs ${group.is_active ? 'text-green-600' : 'text-red-600'}`}>
                          {group.is_active ? 'Активна' : 'Неактивна'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <p className="text-center text-accent py-4">
              Выберите факультет слева
            </p>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm text-yellow-800">
          <strong>Примечание:</strong> Деактивация факультетов и групп не удаляет связанные данные.
          Неактивные записи не отображаются в выпадающих списках при создании плательщиков.
        </p>
      </div>
    </div>
  );
}
