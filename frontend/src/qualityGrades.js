/** Quality Grade master (GET /quality-grades). The app keeps no grade list of its own. */
import { useCallback, useEffect, useState } from 'react';
import { get } from './api';

/**
 * Grades from the database: active only by default, every grade with `all`.
 * Returns { grades, reload, error }.
 */
export function useQualityGrades({ all = false } = {}) {
  const [grades, setGrades] = useState([]);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    try {
      setGrades(await get(`/quality-grades${all ? '?all=true' : ''}`));
      setError('');
    } catch (e) { setError(e.message); }
  }, [all]);
  useEffect(() => { reload(); }, [reload]);
  return { grades, reload, error };
}

/** Dropdown options ({ value: id, label: grade name }). */
export const gradeOptions = (grades) => grades.map((g) => ({ value: g.id, label: g.grade_name }));
