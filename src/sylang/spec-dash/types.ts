/**
 * Type definitions for Sylang Specification and Dashboard files
 */

// ============================================================================
// Common Types
// ============================================================================

export interface SourceReference {
    type?: string;              // Optional node type filter (requirement, function, etc.) - NEW v2.32.0
    filepaths: string[];        // Paths to source files (supports globs: "*.req", "**/*.req", multiple: "file1.req", "file2.req")
    where?: WhereClause;
    groupby?: string;
    orderby?: OrderBy;
    columns?: string[];
}

export interface WhereClause {
    raw: string;                // Original where clause text
    conditions: Condition[];    // Parsed conditions
}

export interface Condition {
    property: string;
    operator: '=' | '!=' | 'in' | 'contains';
    value: string | string[];
    logicalOp?: 'and' | 'or';  // Connection to next condition
}

export interface OrderBy {
    property: string;
    direction: 'asc' | 'desc';
}

// ============================================================================
// Specification (.spec) Types
// ============================================================================

export interface SpecDocument {
    header: SpecHeader;
    sections: SpecSection[];
    sourceFile: string;         // Path to the .spec file
}

export interface SpecHeader {
    id: string;
    name: string;
    owner?: string;
    version?: string;
    generatedDate: string;      // Auto-generated timestamp
}

export interface SpecSection {
    id: string;
    name: string;
    description?: string;
    content: SpecContent[];
    subsections: SpecSection[]; // Nested sections
    line: number;               // Line number in source file
}

export interface SpecContent {
    type: 'spec' | 'diagram' | 'table' | 'dashboard';
    id: string;
    name: string;
    description?: string;
    source: SourceReference;
    line: number;               // Line number in source file
}

// ============================================================================
// Dashboard (.dash) Types
// ============================================================================

export interface DashDocument {
    header: DashHeader;
    widgets: DashWidget[];
    sourceFile: string;         // Path to the .dash file
}

export interface DashHeader {
    id: string;
    name: string;
    owner?: string;
    version?: string;
    grid: GridSize;
    generatedDate: string;      // Auto-generated timestamp
}

export interface GridSize {
    rows: number;
    cols: number;
}

export interface DashWidget {
    type: 'metric' | 'chart' | 'table';
    id: string;
    name: string;
    source: SourceReference;
    position: number;           // Calculated from order (0-indexed)
    span?: WidgetSpan;
    line: number;               // Line number in source file
    
    // Metric-specific
    metricType?: 'count' | 'percentage' | 'sum' | 'avg' | 'min' | 'max' | 'gauge' | 'trend';
    property?: string;          // For avg, sum, min, max
    
    // Chart-specific
    chartType?: 'bar' | 'line' | 'pie' | 'scatter' | 'gauge';
    xaxis?: string;
    yaxis?: string;
}

export interface WidgetSpan {
    rows: number;
    cols: number;
}

// ============================================================================
// Data Fetching Types
// ============================================================================

export interface FetchedData {
    items: DataItem[];
    metadata: DataMetadata;
}

export interface DataItem {
    identifier: string;
    name?: string;
    description?: string;
    properties: Map<string, string[]>;
    kind: string;               // requirement, usecase, function, etc.
    line: number;
    sourceFile: string;
}

export interface DataMetadata {
    totalCount: number;
    filteredCount: number;
    sourceFile: string;
}

// ============================================================================
// Rendering Types
// ============================================================================

export interface RenderOptions {
    theme?: 'light' | 'dark';
    fontSize?: number;
    showLineNumbers?: boolean;
}

export interface RenderedContent {
    html: string;
    css: string;
    javascript?: string;
}

// ============================================================================
// Validation Types
// ============================================================================

export interface ValidationError {
    line: number;
    column: number;
    message: string;
    severity: 'error' | 'warning' | 'info';
    code: string;
}

export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
}

// ============================================================================
// Webview Message Types
// ============================================================================

export type SpecDashMessage = 
    | { type: 'refresh' }
    | { type: 'openSource'; fileUri: string; line?: number }
    | { type: 'downloadHTML' }
    | { type: 'navigateToSymbol'; identifier: string; filepath: string }
    | { type: 'error'; message: string };

// ============================================================================
// Parser Types
// ============================================================================

export interface ParsedLine {
    lineNumber: number;
    indent: number;
    keyword?: string;
    value?: string;
    raw: string;
}

export interface ParserContext {
    currentSection?: SpecSection;
    currentWidget?: DashWidget;
    indentStack: number[];
}

/**
 * TypeScript types for Dashboard (.dash) files
 * 
 * Dashboard Architecture:
 * - Grid-based layout with configurable rows x columns
 * - Three widget types: metric, chart, table
 * - Query complexity levels: simple, complex, very complex
 * - Reuses Symbol Manager for all data queries
 */

export interface DashDocument {
    header: DashHeader;
    widgets: DashWidget[];
}

export interface DashHeader {
    identifier: string;
    name: string;
    owner: string;
    version: string;
    grid: GridLayout;
    generatedDate?: string; // Auto-generated
}

export interface GridLayout {
    rows: number;
    columns: number;
}

export type DashWidget = MetricWidget | ChartWidget | TableWidget;

export interface BaseWidget {
    widgetType: 'metric' | 'chart' | 'table';
    identifier: string;
    name: string;
    query: DashQuery;
    span?: WidgetSpan; // Default: 1x1
}

export interface MetricWidget extends BaseWidget {
    widgetType: 'metric';
    metricType: MetricType;
}

export interface ChartWidget extends BaseWidget {
    widgetType: 'chart';
    chartType: ChartType;
    xaxis?: string;
    yaxis?: string;
}

export interface TableWidget extends BaseWidget {
    widgetType: 'table';
    description?: string;
    columns: string[];
}

export interface WidgetSpan {
    rows: number;
    columns: number;
}

export type MetricType = 'count' | 'percentage' | 'sum' | 'avg' | 'min' | 'max' | 'gauge' | 'trend';
export type ChartType = 'bar' | 'line' | 'pie' | 'scatter' | 'gauge' | 'sankey';

export interface DashQuery {
    type: string; // Widget type: 'count', 'pie', 'bar', etc. (metric/chart type)
    sourcetype: string; // Node type: 'requirement', 'function', 'all', etc. (RENAMED v2.32.0)
    sourcetypes?: string[]; // For multi-type queries (very complex)
    sourceName?: string; // Set identifier for old syntax: source requirementset <Name>
    source?: string[]; // File patterns: "*.req", "**/*.req" (RENAMED from scope v2.32.0)
    where?: WhereClause;
    correlate?: CorrelateClause[];
    analyze?: AnalyzeType;
    groupby?: string;
    orderby?: OrderByClause;
    property?: string; // For avg, sum, min, max
    calculate?: string; // Custom calculate expression (very complex)
}

export interface WhereClause {
    expression: string; // Raw expression string, parsed by queryEngine
}

export interface CorrelateClause {
    nodeType: string;
    via: string; // Relationship keyword (e.g., 'satisfies', 'implements')
    direction?: 'forward' | 'reverse'; // Default: 'forward'
}

export type AnalyzeType = 'broken' | 'orphan' | 'sink' | 'isolated' | 'connected' | 'relationships' | 'all';

export interface OrderByClause {
    property: string;
    direction: 'asc' | 'desc';
}

/**
 * Query complexity classification
 */
export type QueryComplexity = 'simple' | 'complex' | 'veryComplex';

/**
 * Query result data structures
 */
export interface QueryResult {
    success: boolean;
    data?: QueryResultData;
    error?: QueryError;
}

export interface QueryError {
    message: string;
    recommendation: string; // User-friendly fix suggestion
    details?: string;
}

export type QueryResultData =
    | MetricResultData
    | ChartResultData
    | TableResultData;

export interface MetricResultData {
    value: number;
    label?: string;
    unit?: string;
}

export interface ChartResultData {
    labels: string[];
    datasets: ChartDataset[];
    chartType: ChartType;
}

export interface ChartDataset {
    label: string;
    data: number[];
    backgroundColor?: string[];
    borderColor?: string[];
}

export interface TableResultData {
    headers: string[];
    rows: TableRow[];
}

export interface TableRow {
    [key: string]: string | number;
}

/**
 * Relationship analysis result (from relationshipAnalyzer)
 */
export interface SymbolAnalysis {
    symbolName: string;
    symbolType: string;
    status: SymbolStatus;
    outgoingCount: number;
    incomingCount: number;
    brokenOutgoingCount: number;
    relationships: string[]; // List of relationship types used
}

export type SymbolStatus = 'isolated' | 'orphan' | 'sink' | 'connected' | 'broken';

/**
 * IMPORTANT NOTE: Reverse Lookup Implementation
 * 
 * Current implementation uses FORWARD lookup only:
 * - correlate type testcase via satisfies
 * - Finds testcases where testcase.satisfies = requirement.name
 * 
 * FUTURE ENHANCEMENT: Reverse Lookup
 * 
 * Reverse lookup is needed for queries like:
 * - "Find all requirements that are satisfied by tests"
 * - "Find all functions that implement requirements"
 * 
 * Technical Implementation Plan:
 * 1. Add 'direction' field to CorrelateClause:
 *    interface CorrelateClause {
 *      nodeType: string;
 *      via: string;
 *      direction?: 'forward' | 'reverse'; // Default: 'forward'
 *    }
 * 
 * 2. Syntax extension (future):
 *    correlate type testcase via satisfies forward  # Current behavior
 *    correlate type requirement via satisfies reverse # New: reverse lookup
 * 
 * 3. Implementation in complexQueryParser.ts:
 *    - Forward: symbol.properties.get(via) contains target
 *    - Reverse: Scan all target symbols, check if their via property contains source
 * 
 * 4. Performance optimization:
 *    - Build reverse relationship index at query time
 *    - Cache: Map<relationship, Map<targetId, Set<sourceId>>>
 *    - Example: reverseIndex.get('satisfies').get('REQ_001') = Set('TEST_001', 'TEST_002')
 * 
 * 5. Use cases:
 *    - Coverage analysis: "Which requirements have NO tests?" (reverse lookup + exclude)
 *    - Impact analysis: "Which functions are affected by this requirement?" (reverse)
 *    - Traceability: "Show all items that reference this symbol" (reverse)
 * 
 * 6. Validation:
 *    - Ensure relationship keyword supports reverse direction
 *    - Some relationships are unidirectional (e.g., 'childof' only makes sense forward)
 * 
 * NOTE: This is a COMPLEX feature that requires careful design and testing.
 * Defer to Phase 7 or later after core dashboard functionality is stable.
 */

