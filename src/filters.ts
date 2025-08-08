import type { FilterType, SimpleFilter, BehavioralFilter } from "./types.js";

// Filter helper functions

export function checkSimpleFilter(filter: SimpleFilter, dimension: string): boolean {
  const [filterDimension] = filter;
  return filterDimension === dimension;
}

export function checkBehavioralFilter(filter: BehavioralFilter, dimension: string): boolean {
  const [, type] = filter;
  return dimension === `event:${type}`;
}

export function checkSingleFilter(filter: FilterType, dimension: string): boolean {
  if (!Array.isArray(filter)) return false;
  
  // Check if it's a logical filter [operator, [...filters]] (length 2)
  if (filter.length === 2 && Array.isArray(filter[1])) {
    const [, nestedFilters] = filter;
    return nestedFilters.some(f => checkSingleFilter(f, dimension));
  }
  
  // Check if it's a 3-element filter
  if (filter.length === 3) {
    // Check if it's a behavioral filter [operator, type, value]
    if (filter[0] === 'has_done' || filter[0] === 'has_not_done') {
      return checkBehavioralFilter(filter as BehavioralFilter, dimension);
    }
    
    // Check if it's a simple filter [dimension, operator, value]
    if (typeof filter[0] === 'string') {
      return checkSimpleFilter(filter as SimpleFilter, dimension);
    }
  }
  
  return false;
}

export function hasFilterForDimension(
  filters?: Array<FilterType>,
  dimension?: string
): boolean {
  if (filters === undefined || dimension === undefined || dimension === '') return false;
  
  return filters.some(filter => checkSingleFilter(filter, dimension));
}