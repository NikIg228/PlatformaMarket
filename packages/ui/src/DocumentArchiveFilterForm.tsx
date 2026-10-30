import {
  DmButton as Button,
  DmInput as Input,
  DmSelect as Select,
} from "./controls";

import { DmSearch } from "./dm-search";

import type { DocumentArchiveFilters } from "./document-archive-types";
import { categoryLabels } from "./document-archive-presentation";

import type { Dispatch, SetStateAction } from "react";

type Props = {
  filters: DocumentArchiveFilters;
  searchDraft: string;
  onFiltersChange: (next: DocumentArchiveFilters) => void;
  onApplyFilters: (next: DocumentArchiveFilters) => void;
  setSearchDraft: Dispatch<SetStateAction<string>>;
  onResetFilters: () => void;
};

export function DocumentArchiveFilterForm({
  filters,
  searchDraft,
  onFiltersChange,
  onApplyFilters,
  setSearchDraft,
  onResetFilters,
}: Props) {
  return (
    <form
      className="dm-document-filters"
      onSubmit={(event) => {
        event.preventDefault();
        const next = { ...filters, q: searchDraft.trim() };
        onFiltersChange(next);
        onApplyFilters(next);
      }}
    >
      <DmSearch
        aria-label="Поиск документов"
        placeholder="Найти документ"
        value={searchDraft}
        onChange={setSearchDraft}
        onSearch={(value) => {
          const next = { ...filters, q: value };
          onFiltersChange(next);
          onApplyFilters(next);
        }}
      />
      <Select
        aria-label="Категория документа"
        value={filters.category}
        onChange={(_, data) =>
          onFiltersChange({ ...filters, category: data.value })
        }
      >
        <option value="">Все категории</option>
        {Object.entries(categoryLabels).map(([value, label]) => (
          <option value={value} key={value}>
            {label}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Статус документа"
        value={filters.status}
        onChange={(_, data) =>
          onFiltersChange({ ...filters, status: data.value })
        }
      >
        <option value="">Все статусы</option>
        <option value="AWAITING_SIGNATURE">Ожидают подписи</option>
        <option value="SIGNED">Подписаны</option>
        <option value="GENERATED">Готовы</option>
        <option value="FAILED">С ошибкой</option>
        <option value="ARCHIVED">Архивированы</option>
      </Select>
      <Select
        aria-label="Бухгалтерский статус"
        value={filters.accountingStatus}
        onChange={(_, data) =>
          onFiltersChange({ ...filters, accountingStatus: data.value })
        }
      >
        <option value="">Любая проверка</option>
        <option value="PENDING_REVIEW">На проверке</option>
        <option value="REVIEWED">Проверены</option>
        <option value="RECONCILED">Сверены</option>
        <option value="DISPUTED">С расхождением</option>
      </Select>
      <Input
        aria-label="Документы с даты"
        type="date"
        value={filters.dateFrom}
        onChange={(_, data) =>
          onFiltersChange({ ...filters, dateFrom: data.value })
        }
      />
      <Input
        aria-label="Документы по дату"
        type="date"
        value={filters.dateTo}
        onChange={(_, data) =>
          onFiltersChange({ ...filters, dateTo: data.value })
        }
      />
      <Button type="submit" appearance="primary">
        Применить
      </Button>
      <Button type="button" appearance="subtle" onClick={onResetFilters}>
        Сбросить
      </Button>
    </form>
  );
}
