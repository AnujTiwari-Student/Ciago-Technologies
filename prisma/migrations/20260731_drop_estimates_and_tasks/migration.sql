-- Migration: Drop project_estimates and employee_tasks tables
-- These features are removed per new-architecture.md §2 and fixes.md §5/§6

DROP TABLE IF EXISTS project_estimates;
DROP TABLE IF EXISTS employee_tasks;
