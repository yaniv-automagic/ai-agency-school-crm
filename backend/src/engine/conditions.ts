/**
 * Evaluate automation conditions against a record.
 * Supports AND/OR logic with nested groups.
 */

interface Condition {
  field: string;
  operator: string;
  value: any;
}

interface ConditionGroup {
  logic: "AND" | "OR";
  conditions: Condition[];
}

export function evaluateConditions(
  groups: ConditionGroup[] | undefined,
  record: Record<string, any>,
  oldRecord?: Record<string, any>
): boolean {
  // No conditions = always match
  if (!groups || groups.length === 0) return true;

  // All groups must pass (AND between groups)
  return groups.every(group => evaluateGroup(group, record, oldRecord));
}

function evaluateGroup(
  group: ConditionGroup,
  record: Record<string, any>,
  oldRecord?: Record<string, any>
): boolean {
  if (!group.conditions || group.conditions.length === 0) return true;

  const results = group.conditions.map(c => evaluateCondition(c, record, oldRecord));

  if (group.logic === "OR") {
    return results.some(Boolean);
  }
  return results.every(Boolean); // AND
}

function evaluateCondition(
  condition: Condition,
  record: Record<string, any>,
  oldRecord?: Record<string, any>
): boolean {
  const { field, operator, value } = condition;
  const recordValue = record[field];

  switch (operator) {
    case "eq":
    case "equals":
      return String(recordValue) === String(value);

    case "ne":
    case "not_equals":
      return String(recordValue) !== String(value);

    case "gt":
    case "greater_than":
      return Number(recordValue) > Number(value);

    case "lt":
    case "less_than":
      return Number(recordValue) < Number(value);

    case "gte":
      return Number(recordValue) >= Number(value);

    case "lte":
      return Number(recordValue) <= Number(value);

    case "contains":
      return String(recordValue || "").toLowerCase().includes(String(value).toLowerCase());

    case "not_contains":
      return !String(recordValue || "").toLowerCase().includes(String(value).toLowerCase());

    case "starts_with":
      return String(recordValue || "").toLowerCase().startsWith(String(value).toLowerCase());

    case "is_empty":
    case "is-null":
      return recordValue === null || recordValue === undefined || recordValue === "";

    case "is_not_empty":
    case "is-not-null":
      return recordValue !== null && recordValue !== undefined && recordValue !== "";

    case "is_changed":
      return oldRecord ? recordValue !== oldRecord[field] : true;

    case "changed_to":
      return oldRecord ? oldRecord[field] !== value && recordValue === value : recordValue === value;

    case "changed_from":
      return oldRecord ? oldRecord[field] === value && recordValue !== value : false;

    default:
      console.warn(`[Conditions] Unknown operator: ${operator}`);
      return true;
  }
}
