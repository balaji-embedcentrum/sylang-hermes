// Base diagram types
export enum DiagramType {
  FeatureModel = 'feature-model',
  VariantModel = 'variant-model',
  InternalBlockDiagram = 'internal-block-diagram',
  FunctionalDecomposition = 'functional-decomposition',
  FeatureDecomposition = 'feature-decomposition',
  GraphTraversal = 'graph-traversal',
  UseCaseDiagram = 'use-case-diagram',
  SequenceDiagram = 'sequence-diagram',
  FMEADiagram = 'fmea-diagram',
  ImpactGraph = 'impact-graph',
  StateMachineDiagram = 'state-machine-diagram',
  FaultTreeAnalysis = 'fault-tree-analysis'
}

export enum LayoutOrientation {
  TopToBottom = 'top-to-bottom',
  LeftToRight = 'left-to-right'
}

export enum ConstraintType {
  Mandatory = 'mandatory',
  Optional = 'optional',
  Or = 'or',
  Alternative = 'alternative'
}

export enum UpdateTrigger {
  FileClick = 'file-click',
  DiagramFocus = 'diagram-focus',
  FileChange = 'file-change',
  ManualRefresh = 'manual-refresh'
}

// Base diagram data interfaces
export interface DiagramNode {
  id: string;
  name: string;
  type: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  properties: Record<string, string[]>;
  parent?: string;
  children?: string[];
  configValue?: number;
  indentLevel?: number;
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  properties: Record<string, string[]>;
  path?: { x: number; y: number }[];
}

export interface DiagramData {
  type: DiagramType;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  metadata: DiagramMetadata;
  featureModelData?: FeatureModelData;
  variantModelData?: VariantModelData;
  internalBlockDiagramData?: any; // Will be defined later
  graphTraversalData?: any; // Will be defined later
  sequenceDiagramData?: any; // Sequence diagram specific data
  [key: string]: any; // Allow additional properties for different diagram types
}

export interface DiagramMetadata {
  title: string;
  description?: string;
  sourceFile: string;
  lastModified: number;
  nodeCount: number;
  edgeCount: number;
  identifier?: string; // For decomposition diagrams, this is the focus block/feature name
}

export interface DiagramResult {
  success: boolean;
  data?: DiagramData;
  error?: string;
  performance?: {
    renderTime: number;
    layoutTime: number;
    totalTime: number;
  };
}

// Feature Model specific interfaces
export interface FeatureNode extends DiagramNode {
  constraintType: ConstraintType;
  selected?: boolean;
}

export interface FeatureModelData extends DiagramData {
  type: DiagramType.FeatureModel;
  nodes: FeatureNode[];
  orientation: LayoutOrientation;
  rootFeature?: string;
}

// Variant Model specific interfaces
export interface VariantNode extends FeatureNode {
  selected: boolean;
  flags: string[];
}

export interface VariantModelData extends DiagramData {
  type: DiagramType.VariantModel;
  nodes: VariantNode[];
  selectionCount: number;
  totalCount: number;
}

// Internal Block Diagram specific interfaces
export interface SylangBlock {
  id: string;
  name: string;
  description?: string;
  level?: 'productline' | 'system' | 'subsystem' | 'component' | 'module' | 'interface' | 'solution' | 'solutionelement' | 'object' | 'objectelement' | 'buildingblock';
  safetylevel?: string;
  functiontype?: 'solution' | 'function' | 'solutionelement';
  blocktype?: 'object' | 'objectelement' | 'buildingblock' | 'component' | 'part';
  owner?: string;
  tags?: string[];
  designrationale?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  ports: SylangPort[];
  decomposesto?: string[];
  enables?: string[];
  inherits?: string[];
  config?: string;
  fileUri: string;
}

export interface SylangPort {
  id: string;
  name: string;
  description?: string;
  direction: 'in' | 'out';
  porttype?: 'data' | 'communication' | 'control' | 'power' | 'operation' | 'signal';
  owner?: string;
  safetylevel?: string;
  tags?: string[];
  x: number;
  y: number;
  width?: number;  // Port rectangle width
  height?: number; // Port rectangle height
  config?: string;
  side?: 'left' | 'right'; // Optional: override default side placement (left/right keyword support)
}

export interface SylangConnection {
  id: string;
  from: string; // port id
  to: string;   // port id
  type?: string;
}

export interface InternalBlockDiagramData {
  type: DiagramType.InternalBlockDiagram;
  blocks: SylangBlock[];
  connections: SylangConnection[];
  metadata: DiagramMetadata;
}

// Graph Traversal specific interfaces
export interface GraphNode extends DiagramNode {
  symbolType: 'hdef' | 'def';
  fileUri: string;
  connections: string[];
}

export interface GraphEdge extends DiagramEdge {
  relationType: string;
  cardinality?: '1:1' | '1:many' | 'many:many';
}

export interface GraphTraversalData extends DiagramData {
  type: DiagramType.GraphTraversal;
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters: { [key: string]: string[] };
  fileGroups: { [key: string]: string[] };
}



// Use Case Diagram specific interfaces
export interface UCDActor extends DiagramNode {
  actortype: 'primary' | 'secondary';
  associatedFunctions: string[];
  includesFunctions: string[];
  indentLevel: number;
}

export interface UCDFunction extends DiagramNode {
  functionName: string;
  parentActor?: string;
  relationshipType: 'associated' | 'includes';
  indentLevel: number;
}

export interface UCDRelationship extends DiagramEdge {
  type: 'associated' | 'includes';
  style: 'solid' | 'dashed';
  actorId: string;
  functionId: string;
}

export interface UseCaseDiagramData extends DiagramData {
  type: DiagramType.UseCaseDiagram;
  actors: UCDActor[];
  functions: UCDFunction[];
  relationships: UCDRelationship[];
  useCaseName: string;
  useCaseProperties: Record<string, string[]>;
}

// State Machine Diagram interfaces
export interface SMDState extends DiagramNode {
  type: 'state';
  name: string;
  description?: string;
  isInitial: boolean;
  isEnd: boolean;
  properties: Record<string, string[]>;
}

export interface SMDTransition extends DiagramEdge {
  type: 'transition';
  name: string;
  description?: string;
  condition: string;
  fromStateId: string;
  toStateId: string;
  functionCall?: string;
  properties: Record<string, string[]>;
}

export interface StateMachineDiagramData extends DiagramData {
  type: DiagramType.StateMachineDiagram;
  states: SMDState[];
  transitions: SMDTransition[];
  stateMachineName: string;
  stateMachineProperties: Record<string, string[]>;
}

// Layout algorithm interfaces
export interface LayoutOptions {
  orientation?: LayoutOrientation;
  spacing?: {
    horizontal: number;
    vertical: number;
  };
  padding?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  [key: string]: any;
}

export interface LayoutResult {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  performance: {
    layoutTime: number;
    iterationCount: number;
  };
}

// Webview communication interfaces
export interface WebviewMessage {
  type: string;
  payload: any;
  timestamp: number;
}

export interface DiagramLogMessage extends WebviewMessage {
  type: 'log';
  payload: {
    message: string;
    level?: 'debug' | 'info' | 'warn' | 'error';
  };
}

export interface DiagramUpdateMessage extends WebviewMessage {
  type: 'update';
  payload: {
    diagramType: DiagramType;
    data: DiagramData;
  };
}

export interface DiagramExportMessage extends WebviewMessage {
  type: 'export';
  payload: {
    format: 'png' | 'svg' | 'pdf';
    filename?: string;
  };
}

export interface DiagramRefreshMessage extends WebviewMessage {
  type: 'refresh';
  payload: {
    diagramType: DiagramType;
    sourceFile: string;
  };
}

// Performance monitoring interfaces
export interface PerformanceMetrics {
  renderTime: number;
  layoutTime: number;
  dataTransformTime: number;
  totalTime: number;
  memoryUsage: number;
  nodeCount: number;
  edgeCount: number;
}

export interface PerformanceThresholds {
  maxRenderTime: number;
  maxLayoutTime: number;
  maxMemoryUsage: number;
  maxNodeCount: number;
  maxEdgeCount: number;
}

// FMEA Diagram Types
export interface FMEAFailureSet {
  id: string;
  name: string;
  level: 'system' | 'subsystem' | 'module' | 'part' | 'solution' | 'solutionelement' | 'object' | 'objectelement' | 'buildingblock';
  propagateTo?: string; // Reference to parent failureset
  failureModes: FMEAFailureMode[];
  position: { x: number; y: number };
  rpnTotal: number;
}

export interface FMEAFailureMode {
  id: string;
  name: string;
  description: string;
  severity: number;
  occurrence: number;
  detectability: number;
  rpn: number;
  safetylevel?: string;

  // Enhanced temporal properties
  faultDetectionTime?: number;    // milliseconds
  faultToleranceTime?: number;    // milliseconds
  propagationDelay?: number;      // milliseconds
  recoveryTime?: number;          // milliseconds

  // Existing relationships
  causedby: string[];
  effects: string[];
}

export interface FMEAPropagationPath {
  id: string;
  from: string; // failureset id
  to: string;   // failureset id
  failureModes: string[]; // failure mode ids that propagate
}

export interface FMEADiagramData extends DiagramData {
  type: DiagramType.FMEADiagram;
  failureSets: FMEAFailureSet[];
  propagationPaths: FMEAPropagationPath[];
  levels: string[]; // ordered levels: system, subsystem, module, part
}

// Impact Graph Types
export interface ImpactGraphData extends DiagramData {
  type: DiagramType.ImpactGraph;
  nodes: GraphNode[];
  edges: GraphEdge[];
  focusNodeId: string; // The central node being analyzed
  upstreamNodes: string[]; // Parent chain
  downstreamNodes: string[]; // Children tree
  clusters: { [key: string]: string[] };
  fileGroups: { [key: string]: string[] };
}

// Fault Tree Analysis Types
export interface FTAGateData {
  id: string;
  name: string;
  gateType: 'and' | 'or' | 'xor' | 'inhibit' | 'pand' | 'voting';
  inputs: string[];  // IDs of input gates or events
  output?: string;   // ID of output gate or event
  position: { x: number; y: number };
  width: number;
  height: number;
  votingK?: number;  // For K/N voting gates
  votingN?: number;
  description?: string;
}

export interface FTAEventData {
  id: string;
  name: string;
  eventType: 'top' | 'intermediate' | 'basic' | 'undeveloped' | 'conditional' | 'house' | 'transfer-in' | 'transfer-out' | 'external';
  probability?: number;
  failureRate?: number;
  description?: string;
  position: { x: number; y: number };
  width: number;
  height: number;
  failuremodeRef?: string; // Reference to failuremode symbol
}

export interface FTAConnectionData {
  id: string;
  source: string;  // Gate or event ID
  target: string;  // Gate or event ID
  verticalOffset?: number;
}

export interface FaultTreeDiagramData extends DiagramData {
  type: DiagramType.FaultTreeAnalysis;
  faultTreeName: string;
  topEvent?: FTAEventData;
  gates: FTAGateData[];
  events: FTAEventData[];
  connections: FTAConnectionData[];
  safetyLevel?: 'ASIL-A' | 'ASIL-B' | 'ASIL-C' | 'ASIL-D' | 'QM';
}
