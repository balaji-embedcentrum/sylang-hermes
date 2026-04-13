/**
 * Query Engine for Sylang Specification and Dashboard files
 * Implements where/groupby/orderby logic for filtering and organizing data
 */

import { WhereClause, Condition, OrderBy, DataItem } from './types';

export class QueryEngine {
    /**
     * Parse a where clause string into structured conditions
     */
    static parseWhereClause(whereClauseText: string): WhereClause {
        const conditions: Condition[] = [];
        
        // Remove leading "where" keyword if present
        let text = whereClauseText.trim();
        if (text.toLowerCase().startsWith('where ')) {
            text = text.substring(6).trim();
        }
        
        // Split by logical operators while preserving them
        const tokens = this.tokenizeWhereClause(text);
        
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            
            if (token.type === 'condition') {
                const condition = this.parseCondition(token.value);
                if (condition) {
                    // Check if next token is a logical operator
                    if (i + 1 < tokens.length && tokens[i + 1].type === 'logical') {
                        condition.logicalOp = tokens[i + 1].value as 'and' | 'or';
                    }
                    conditions.push(condition);
                }
            }
        }
        
        return {
            raw: whereClauseText,
            conditions
        };
    }
    
    /**
     * Tokenize where clause into conditions and logical operators
     */
    private static tokenizeWhereClause(text: string): Array<{type: 'condition' | 'logical', value: string}> {
        const tokens: Array<{type: 'condition' | 'logical', value: string}> = [];
        let current = '';
        let inParentheses = 0;
        let inQuotes = false;
        
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
                current += char;
            } else if (char === '(' && !inQuotes) {
                inParentheses++;
                current += char;
            } else if (char === ')' && !inQuotes) {
                inParentheses--;
                current += char;
            } else if (!inQuotes && inParentheses === 0) {
                // Check for logical operators
                const remaining = text.substring(i);
                if (remaining.toLowerCase().startsWith(' and ')) {
                    if (current.trim()) {
                        tokens.push({type: 'condition', value: current.trim()});
                    }
                    tokens.push({type: 'logical', value: 'and'});
                    current = '';
                    i += 4; // Skip ' and '
                    continue;
                } else if (remaining.toLowerCase().startsWith(' or ')) {
                    if (current.trim()) {
                        tokens.push({type: 'condition', value: current.trim()});
                    }
                    tokens.push({type: 'logical', value: 'or'});
                    current = '';
                    i += 3; // Skip ' or '
                    continue;
                }
            }
            
            current += char;
        }
        
        if (current.trim()) {
            tokens.push({type: 'condition', value: current.trim()});
        }
        
        return tokens;
    }
    
    /**
     * Parse a single condition (e.g., "status = approved", "reqtype in [functional, safety]")
     */
    private static parseCondition(conditionText: string): Condition | null {
        // Remove parentheses if present
        let text = conditionText.trim();
        if (text.startsWith('(') && text.endsWith(')')) {
            text = text.substring(1, text.length - 1).trim();
        }
        
        // Try to match different operators
        const operators = ['!=', '=', ' in ', ' contains '];
        
        for (const op of operators) {
            const index = text.indexOf(op);
            if (index > 0) {
                const property = text.substring(0, index).trim();
                const valueText = text.substring(index + op.length).trim();
                
                let operator: '=' | '!=' | 'in' | 'contains';
                if (op === '!=') operator = '!=';
                else if (op === '=') operator = '=';
                else if (op.trim() === 'in') operator = 'in';
                else operator = 'contains';
                
                let value: string | string[];
                
                // Parse value
                if (operator === 'in') {
                    // Parse array: [value1, value2, value3]
                    if (valueText.startsWith('[') && valueText.endsWith(']')) {
                        const arrayContent = valueText.substring(1, valueText.length - 1);
                        value = arrayContent.split(',').map(v => v.trim().replace(/"/g, ''));
                    } else {
                        value = [valueText.replace(/"/g, '')];
                    }
                } else {
                    value = valueText.replace(/"/g, '');
                }
                
                return {
                    property,
                    operator,
                    value
                };
            }
        }
        
        return null;
    }
    
    /**
     * Apply where clause to filter data items
     */
    static applyWhereClause(items: DataItem[], whereClause: WhereClause): DataItem[] {
        if (!whereClause.conditions || whereClause.conditions.length === 0) {
            return items;
        }
        
        return items.filter(item => this.evaluateConditions(item, whereClause.conditions));
    }
    
    /**
     * Evaluate all conditions for a single item
     */
    private static evaluateConditions(item: DataItem, conditions: Condition[]): boolean {
        if (conditions.length === 0) return true;
        
        let result = this.evaluateCondition(item, conditions[0]);
        
        for (let i = 1; i < conditions.length; i++) {
            const condition = conditions[i];
            const conditionResult = this.evaluateCondition(item, condition);
            
            const prevLogicalOp = conditions[i - 1].logicalOp;
            if (prevLogicalOp === 'and') {
                result = result && conditionResult;
            } else if (prevLogicalOp === 'or') {
                result = result || conditionResult;
            }
        }
        
        return result;
    }
    
    /**
     * Evaluate a single condition for an item
     */
    private static evaluateCondition(item: DataItem, condition: Condition): boolean {
        const propertyValues = item.properties.get(condition.property);
        
        if (!propertyValues || propertyValues.length === 0) {
            return false;
        }
        
        const conditionValue = condition.value;
        
        switch (condition.operator) {
            case '=':
                return propertyValues.some(v => v.toLowerCase() === (conditionValue as string).toLowerCase());
            
            case '!=':
                return !propertyValues.some(v => v.toLowerCase() === (conditionValue as string).toLowerCase());
            
            case 'in':
                const targetValues = (conditionValue as string[]).map(v => v.toLowerCase());
                return propertyValues.some(v => targetValues.includes(v.toLowerCase()));
            
            case 'contains':
                return propertyValues.some(v => v.toLowerCase().includes((conditionValue as string).toLowerCase()));
            
            default:
                return false;
        }
    }
    
    /**
     * Group items by a property
     */
    static groupBy(items: DataItem[], property: string): Map<string, DataItem[]> {
        const groups = new Map<string, DataItem[]>();
        
        for (const item of items) {
            const values = item.properties.get(property);
            if (values && values.length > 0) {
                const key = values[0]; // Use first value for grouping
                if (!groups.has(key)) {
                    groups.set(key, []);
                }
                groups.get(key)!.push(item);
            } else {
                // Items without the property go to "undefined" group
                if (!groups.has('undefined')) {
                    groups.set('undefined', []);
                }
                groups.get('undefined')!.push(item);
            }
        }
        
        return groups;
    }
    
    /**
     * Sort items by a property
     */
    static orderBy(items: DataItem[], orderBy: OrderBy): DataItem[] {
        const sorted = [...items];
        
        sorted.sort((a, b) => {
            const aValues = a.properties.get(orderBy.property);
            const bValues = b.properties.get(orderBy.property);
            
            const aValue = aValues && aValues.length > 0 ? aValues[0] : '';
            const bValue = bValues && bValues.length > 0 ? bValues[0] : '';
            
            let comparison = 0;
            
            // Try numeric comparison first
            const aNum = parseFloat(aValue);
            const bNum = parseFloat(bValue);
            
            if (!isNaN(aNum) && !isNaN(bNum)) {
                comparison = aNum - bNum;
            } else {
                // String comparison
                comparison = aValue.localeCompare(bValue);
            }
            
            return orderBy.direction === 'desc' ? -comparison : comparison;
        });
        
        return sorted;
    }
    
    /**
     * Parse orderby string (e.g., "identifier", "identifier asc", "identifier desc")
     */
    static parseOrderBy(orderByText: string): OrderBy {
        const parts = orderByText.trim().split(/\s+/);
        const property = parts[0];
        const direction = parts.length > 1 && parts[1].toLowerCase() === 'desc' ? 'desc' : 'asc';
        
        return { property, direction };
    }
}

