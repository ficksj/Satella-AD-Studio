import React, { useState } from 'react';
import {
  Sparkles,
  UserPlus,
  FolderTree,
  Shield,
  CheckCircle2,
  Briefcase,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Search,
} from 'lucide-react';
import type { AdGroup, OnboardingTemplate, OuNode } from '../types';

interface Props {
  templates: OnboardingTemplate[];
  ouTree: OuNode[];
  groups: AdGroup[];
  onSaveTemplate: (tpl: OnboardingTemplate) => void;
  onDeleteTemplate: (id: string) => void;
  onExecuteOnboarding: (data: {
    templateId: string;
    givenName: string;
    surname: string;
    samAccountName: string;
    email: string;
    telephone: string;
    password: string;
  }) => void;
}

const cyrillicMap: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh',
  з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

function transliterate(str: string): string {
  return str
    .toLowerCase()
    .split('')
    .map((ch) => (cyrillicMap[ch] !== undefined ? cyrillicMap[ch] : ch))
    .join('')
    .replace(/[^a-z0-9]/g, '');
}

export const AutomationView: React.FC<Props> = ({
  templates,
  ouTree,
  groups,
  onSaveTemplate,
  onDeleteTemplate,
  onExecuteOnboarding,
}) => {
  const [selectedTpl, setSelectedTpl] = useState<OnboardingTemplate | null>(
    templates[0] || null
  );
  const [givenName, setGivenName] = useState('Максим');
  const [surname, setSurname] = useState('Романов');
  const [samAccountName, setSamAccountName] = useState('m.romanov');
  const [email, setEmail] = useState('m.romanov@satella.io');
  const [telephone, setTelephone] = useState('+7 (495) 700-45-19');
  const [password, setPassword] = useState('Satella#Welcome2026');

  // Template Creator / Editor Modal
  const [editingTpl, setEditingTpl] = useState<OnboardingTemplate | null>(null);
  const [tplGroupSearch, setTplGroupSearch] = useState('');

  React.useEffect(() => {
    if (selectedTpl) {
      const updated = templates.find((t) => t.id === selectedTpl.id);
      setSelectedTpl(updated || templates[0] || null);
    } else if (templates.length > 0) {
      setSelectedTpl(templates[0]);
    }
  }, [templates]);

  const flattenOus = (nodes: OuNode[]): OuNode[] => {
    let list: OuNode[] = [];
    for (const n of nodes) {
      list.push(n);
      if (n.children?.length) list = list.concat(flattenOus(n.children));
    }
    return list;
  };
  const allOus = flattenOus(ouTree);

  const handleNameChange = (newGiven: string, newSurname: string) => {
    setGivenName(newGiven);
    setSurname(newSurname);
    const g = transliterate(newGiven);
    const s = transliterate(newSurname);
    if (g && s) {
      const login = `${g[0]}.${s}`;
      setSamAccountName(login);
      setEmail(`${login}@satella.io`);
    }
  };

  const openNewTemplateModal = () => {
    setTplGroupSearch('');
    setEditingTpl({
      id: '',
      name: 'Системный администратор AD',
      description:
        'Создание учётной записи инженера инфраструктуры с доступом к VPN, серверам и Helpdesk.',
      roleCategory: 'IT & Infra',
      targetOuDn:
        allOus.find((o) => o.name === 'Engineering')?.distinguishedName ||
        allOus[0]?.distinguishedName ||
        'DC=corp,DC=satella,DC=local',
      title: 'Systems Administrator',
      department: 'IT Infrastructure',
      company: 'Satella Enterprise',
      office: 'HQ Moscow Tower A',
      defaultGroups: [],
      homeDirectoryPattern: '\\\\fs01.corp.satella.local\\profiles\\%username%',
      mustChangePassword: true,
    });
  };

  return (
    <div className="p-6 h-full overflow-y-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-400" />
            Ролевая автоматизация и Конструктор шаблонов онбординга
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Создавайте собственные шаблоны должностей (OU + группы доступа +
            атрибуты) и проводите онбординг сотрудников в 1 клик
          </p>
        </div>

        <button
          onClick={openNewTemplateModal}
          className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 transition"
        >
          <Plus className="h-4 w-4" /> Создать свой шаблон роли
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Role Templates List */}
        <div className="lg:col-span-5 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            1. Выберите или отредактируйте ролевой шаблон ({templates.length})
          </div>
          {templates.map((tpl) => {
            const isSelected = selectedTpl?.id === tpl.id;
            return (
              <div
                key={tpl.id}
                onClick={() => setSelectedTpl(tpl)}
                className={`rounded-xl border p-4 cursor-pointer transition ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-indigo-400" />
                    <span className="text-sm font-semibold text-zinc-100">
                      {tpl.name}
                    </span>
                  </div>
                  <div
                    className="flex items-center gap-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-indigo-300">
                      {tpl.roleCategory}
                    </span>
                    <button
                      onClick={() => {
                        setTplGroupSearch('');
                        setEditingTpl(JSON.parse(JSON.stringify(tpl)));
                      }}
                      title="Редактировать шаблон"
                      className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {templates.length > 1 && (
                      <button
                        onClick={() => onDeleteTemplate(tpl.id)}
                        title="Удалить шаблон"
                        className="rounded p-1 text-zinc-500 hover:bg-rose-500/15 hover:text-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-1.5 text-xs text-zinc-400">{tpl.description}</p>
                <div className="mt-2 font-mono text-[10px] text-amber-300/90 truncate">
                  OU: {tpl.targetOuDn}
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {tpl.defaultGroups.map((g) => (
                    <span
                      key={g}
                      className="rounded bg-zinc-950 border border-zinc-800 px-2 py-0.5 font-mono text-[10px] text-zinc-300"
                    >
                      {g.split(',')[0]?.replace('CN=', '')}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Onboarding Execution Form */}
        <div className="lg:col-span-7">
          {selectedTpl && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100">
                    2. Карточка нового сотрудника по шаблону «{selectedTpl.name}»
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Целевое подразделение:{' '}
                    <code className="text-amber-300">
                      {selectedTpl.targetOuDn}
                    </code>
                  </p>
                </div>
                <button
                  onClick={() => {
                    setTplGroupSearch('');
                    setEditingTpl(JSON.parse(JSON.stringify(selectedTpl)));
                  }}
                  className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700"
                >
                  <Pencil className="h-3 w-3" /> Изменить шаблон
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-zinc-400 mb-1">
                    Имя (авто-транслитерация)
                  </label>
                  <input
                    value={givenName}
                    onChange={(e) => handleNameChange(e.target.value, surname)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">
                    Фамилия (авто-транслитерация)
                  </label>
                  <input
                    value={surname}
                    onChange={(e) => handleNameChange(givenName, e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">
                    Логин AD (sAMAccountName)
                  </label>
                  <input
                    value={samAccountName}
                    onChange={(e) => setSamAccountName(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-indigo-300"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">
                    Корпоративная почта
                  </label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-zinc-200"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">Телефон</label>
                  <input
                    value={telephone}
                    onChange={(e) => setTelephone(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-200"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">
                    Стартовый пароль
                  </label>
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-emerald-300"
                  />
                </div>
              </div>

              {/* Preview of automated actions */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 space-y-2 text-xs">
                <div className="font-semibold text-zinc-300">
                  Что будет автоматически выполнено в Active Directory:
                </div>
                <div className="flex items-center gap-2 text-zinc-400">
                  <FolderTree className="h-3.5 w-3.5 text-amber-400" />
                  <span>
                    Размещение в OU:{' '}
                    <code className="text-zinc-200">
                      {selectedTpl.targetOuDn}
                    </code>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-zinc-400">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span>
                    Заполнение атрибутов: Должность «{selectedTpl.title}», Отдел
                    «{selectedTpl.department}», Офис «{selectedTpl.office}»
                  </span>
                </div>
                <div className="flex items-center gap-2 text-zinc-400">
                  <Shield className="h-3.5 w-3.5 text-indigo-400" />
                  <span>
                    Включение в {selectedTpl.defaultGroups.length} групп RBAC:{' '}
                    {selectedTpl.defaultGroups
                      .map((g) => g.split(',')[0]?.replace('CN=', ''))
                      .join(', ') || 'Без дополнительных групп'}
                  </span>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() =>
                    onExecuteOnboarding({
                      templateId: selectedTpl.id,
                      givenName,
                      surname,
                      samAccountName,
                      email,
                      telephone,
                      password,
                    })
                  }
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 transition"
                >
                  <UserPlus className="h-4 w-4" /> Создать сотрудника по шаблону
                  в 1 клик
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Create / Edit Template */}
      {editingTpl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-semibold text-zinc-100">
                {editingTpl.id
                  ? `Редактирование шаблона: ${editingTpl.name}`
                  : 'Создание нового шаблона онбординга'}
              </h3>
              <button
                onClick={() => setEditingTpl(null)}
                className="rounded p-1 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1">
                    Название шаблона роли
                  </label>
                  <input
                    value={editingTpl.name}
                    onChange={(e) =>
                      setEditingTpl({ ...editingTpl, name: e.target.value })
                    }
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">
                    Категория / Подразделение
                  </label>
                  <input
                    value={editingTpl.roleCategory}
                    onChange={(e) =>
                      setEditingTpl({
                        ...editingTpl,
                        roleCategory: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-zinc-400 mb-1">
                    Описание шаблона
                  </label>
                  <input
                    value={editingTpl.description}
                    onChange={(e) =>
                      setEditingTpl({
                        ...editingTpl,
                        description: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-zinc-400 mb-1">
                    Целевое подразделение (Target OU)
                  </label>
                  <select
                    value={editingTpl.targetOuDn}
                    onChange={(e) =>
                      setEditingTpl({
                        ...editingTpl,
                        targetOuDn: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-zinc-100"
                  >
                    {allOus.map((o) => (
                      <option key={o.distinguishedName} value={o.distinguishedName}>
                        {o.name} — ({o.distinguishedName})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">
                    Должность по умолчанию (Title)
                  </label>
                  <input
                    value={editingTpl.title}
                    onChange={(e) =>
                      setEditingTpl({ ...editingTpl, title: e.target.value })
                    }
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">
                    Отдел по умолчанию (Department)
                  </label>
                  <input
                    value={editingTpl.department}
                    onChange={(e) =>
                      setEditingTpl({
                        ...editingTpl,
                        department: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100"
                  />
                </div>
              </div>

              {/* Group Selector */}
              <div className="space-y-2 pt-2 border-t border-zinc-800">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-zinc-300">
                    Автоматически назначаемые группы безопасности (
                    {editingTpl.defaultGroups.length})
                  </label>
                  <div className="relative w-64">
                    <Search className="h-3.5 w-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      value={tplGroupSearch}
                      onChange={(e) => setTplGroupSearch(e.target.value)}
                      placeholder="Поиск группы..."
                      className="w-full rounded border border-zinc-800 bg-zinc-900 pl-8 pr-2.5 py-1 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                  {groups
                    .filter(
                      (g) =>
                        !tplGroupSearch.trim() ||
                        g.displayName
                          .toLowerCase()
                          .includes(tplGroupSearch.toLowerCase()) ||
                        g.description
                          .toLowerCase()
                          .includes(tplGroupSearch.toLowerCase())
                    )
                    .map((g) => {
                      const checked = editingTpl.defaultGroups.some(
                        (d) =>
                          d.toLowerCase() === g.distinguishedName.toLowerCase()
                      );
                      return (
                        <label
                          key={g.id}
                          className={`flex items-center gap-2 rounded-lg border p-2 cursor-pointer ${
                            checked
                              ? 'border-indigo-500/40 bg-indigo-500/15 text-zinc-100'
                              : 'border-zinc-800 bg-zinc-900/40 text-zinc-400'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditingTpl({
                                  ...editingTpl,
                                  defaultGroups: [
                                    ...editingTpl.defaultGroups,
                                    g.distinguishedName,
                                  ],
                                });
                              } else {
                                setEditingTpl({
                                  ...editingTpl,
                                  defaultGroups: editingTpl.defaultGroups.filter(
                                    (x) =>
                                      x.toLowerCase() !==
                                      g.distinguishedName.toLowerCase()
                                  ),
                                });
                              }
                            }}
                          />
                          <span className="truncate font-medium">
                            {g.displayName}
                          </span>
                        </label>
                      );
                    })}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-800 pt-3">
              <button
                onClick={() => setEditingTpl(null)}
                className="rounded-lg border border-zinc-800 px-4 py-2 text-xs text-zinc-400"
              >
                Отмена
              </button>
              <button
                onClick={() => {
                  onSaveTemplate(editingTpl);
                  setEditingTpl(null);
                }}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
              >
                <Save className="h-3.5 w-3.5" /> Сохранить шаблон
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
