/**
 * Relation Matrix (code source of truth)
 *
 * This is intentionally data-driven so you can extend it over time.
 * It encodes:
 *  - allowed relation keywords per sourceType
 *  - allowed target node types per (sourceType, relation)
 *  - required imported SET type for a given target node type (for ID dropdown population)
 */

export type SourceType = string // e.g. 'requirement', 'requirementset', 'function', 'functionset', etc.
export type RelationKeyword = string // e.g. 'derivedfrom', 'allocatedto', ...
export type TargetNodeType = string // e.g. 'requirement', 'block', 'function', ...

export type RelationMatrix = Record<SourceType, Record<RelationKeyword, TargetNodeType[]>>

/**
 * target node type -> required imported parent set type (header keyword)
 * Used for resolving target IDs via `use` imports + SymbolManager.
 */
export const TARGET_NODETYPE_TO_SET: Record<string, string> = {
  requirement: 'requirementset',
  function: 'functionset',
  feature: 'featureset',
  block: 'block', // blocks use 'hdef block' directly (no blockset)
  testcase: 'testset',
  config: 'configset',
  operation: 'interfaceset',
  signal: 'interfaceset',
  parameter: 'interfaceset',
  datatype: 'interfaceset',
  characteristic: 'block', // characteristics are defined within block files
  failuremode: 'failureset',
  hazard: 'hazardset',
  safetymechanism: 'safetymechanismset',
  safetygoal: 'safetygoalset',
  agent: 'agentset', // agents are defined in .agt files with hdef agentset
}

/**
 * NOTE: Seeded with the common relations described in relations-matrix-help.md.
 * Extend as needed (add new source types / relations / target types).
 */
export const RELATION_MATRIX: RelationMatrix = {
  // Requirements (.req)
  requirement: {
    refinedfrom: ['requirement'],
    derivedfrom: ['requirement'],
    implements: ['function'],
    allocatedto: ['block'],
    requires: ['parameter'],
    meets: ['characteristic', 'safetygoal'],
    when: ['config'],
  },

  // Function group (.fun)
  function: {
    enables: ['feature'],
    allocatedto: ['block'],
    decomposesto: ['function'],
    derivedfrom: ['requirement'],
    implementedby: ['requirement'],
    requires: ['parameter'],
    meets: ['characteristic', 'safetygoal'],
    when: ['config'],
    detects: ['failuremode'],
  },

  // Block definition (.blk)
  block: {
    decomposesto: ['block'],
    implements: ['function'],
    enables: ['feature'],
    derivedfrom: ['requirement'],
    implementedby: ['requirement'],
    requires: ['parameter', 'datatype'],
    meets: ['characteristic', 'safetygoal'],
    when: ['config'],
    needs: ['operation', 'signal'],
    provides: ['operation', 'signal'],
  },

  // Feature model (.fml)
  feature: {
    performs: ['function'],
    requires: ['feature'],
    excludes: ['feature'],
    inherits: ['feature'],
    meets: ['characteristic', 'safetygoal'],
    needs: ['operation', 'signal'],
    provides: ['operation', 'signal'],
  },

  // Interface (.ifc)
  operation: {
    derivedfrom: ['requirement'],
    implementedby: ['requirement'],
    requires: ['datatype'],
    meets: ['characteristic', 'safetygoal'],
    when: ['config'],
  },
  signal: {
    derivedfrom: ['requirement'],
    implementedby: ['requirement'],
    requires: ['datatype'],
    meets: ['characteristic', 'safetygoal'],
    when: ['config'],
  },

  // Test (.tst)
  testcase: {
    refinedfrom: ['testcase'],
    derivedfrom: ['requirement'],
    satisfies: ['requirement'],
    requires: ['parameter'],
    meets: ['characteristic', 'safetygoal'],
    when: ['config'],
  },

  // Sprint items (.spr)
  epic: {
    assignedto: ['agent'],
  },
  story: {
    assignedto: ['agent'],
  },
  task: {
    assignedto: ['agent'],
  },
}

export function normalizeType(x: string): string {
  // ProseMirror table cells can contain NBSP and other whitespace artifacts.
  // We canonicalize by:
  // - replacing NBSP with space
  // - trimming
  // - lowercasing
  // - removing spaces/underscores (so "node type", "node_type" -> "nodetype")
  return (x || '')
    .toString()
    .replace(/\u00a0/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '')
}

export function getAllowedRelations(sourceType: SourceType): RelationKeyword[] {
  const src = normalizeType(sourceType)
  const rels = RELATION_MATRIX[src]
  if (!rels) return []
  return Object.keys(rels).sort((a, b) => a.localeCompare(b))
}

export function getAllowedTargetNodeTypes(sourceType: SourceType, relation: RelationKeyword): TargetNodeType[] {
  const src = normalizeType(sourceType)
  const rel = normalizeType(relation)
  const rels = RELATION_MATRIX[src]
  if (!rels) return []
  const targets = rels[rel] || []
  return Array.from(new Set(targets.map(normalizeType))).sort((a, b) => a.localeCompare(b))
}

export function getRequiredSetTypeForTargetNodeType(targetNodeType: TargetNodeType): string | null {
  const t = normalizeType(targetNodeType)
  return TARGET_NODETYPE_TO_SET[t] || null
}

// =============================================================================
// INSERTABLE BLOCKS PER FILE TYPE
// Maps which block types can be inserted via insert menu for each file extension
// This is the source of truth for the insert/slash menu in the editor
// =============================================================================

export const INSERTABLE_BLOCKS: Record<string, { keyword: string; displayName: string }[]> = {
  '.req': [{ keyword: 'requirement', displayName: 'Requirement' }],
  '.fun': [{ keyword: 'function', displayName: 'Function' }],
  '.tst': [{ keyword: 'testcase', displayName: 'Test Case' }],
  '.blk': [], // No insert - only one block per .blk file (block is the header)
  '.ifc': [
    { keyword: 'operation', displayName: 'Operation' },
    { keyword: 'signal', displayName: 'Signal' },
    { keyword: 'datatype', displayName: 'Data Type' },
    { keyword: 'parameter', displayName: 'Parameter' }
  ],
  '.flr': [{ keyword: 'failuremode', displayName: 'Failure Mode' }],
  '.sgl': [{ keyword: 'safetygoal', displayName: 'Safety Goal' }],
  '.sam': [{ keyword: 'safetymechanism', displayName: 'Safety Mechanism' }],
  '.fta': [{ keyword: 'gate', displayName: 'Gate' }],
  '.agt': [{ keyword: 'agent', displayName: 'Agent' }],
  '.ucd': [
    { keyword: 'actor', displayName: 'Actor' },
    { keyword: 'usecase', displayName: 'Use Case' }
  ],
  '.seq': [
    { keyword: 'sequence', displayName: 'Sequence' },
    { keyword: 'fragment', displayName: 'Fragment' }
  ],
  '.spr': [
    { keyword: 'epic', displayName: 'Epic' },
    { keyword: 'story', displayName: 'Story' },
    { keyword: 'task', displayName: 'Task' }
  ],
  '.itm': [
    { keyword: 'boundary', displayName: 'Boundary' },
    { keyword: 'operatingmode', displayName: 'Operating Mode' }
  ],
  '.haz': [
    { keyword: 'hazard', displayName: 'Hazard' },
    { keyword: 'situation', displayName: 'Situation' }
  ],
  '.smd': [
    { keyword: 'state', displayName: 'State' },
    { keyword: 'transition', displayName: 'Transition' }
  ],
  '.fml': [{ keyword: 'feature', displayName: 'Feature' }],
  '.vml': [{ keyword: 'variant', displayName: 'Variant' }],
  '.vcf': [{ keyword: 'config', displayName: 'Config' }],

}

export function getInsertableBlocks(fileExtension: string): { keyword: string; displayName: string }[] {
  const ext = fileExtension.toLowerCase().startsWith('.') ? fileExtension.toLowerCase() : `.${fileExtension.toLowerCase()}`
  return INSERTABLE_BLOCKS[ext] || []
}

// =============================================================================
// BLOCK PROPERTY MAPPINGS
// Maps which properties are allowed per block type (header or def)
// Extracted from keywords.ts - each block has properties relevant to its file type
// =============================================================================

export const BLOCK_PROPERTIES: Record<string, string[]> = {
  // .req - Requirements (REQ_KEYWORDS)
  requirementset: ['name', 'description', 'owner', 'tags'],
  requirement: ['name', 'description', 'owner', 'tags', 'rationale', 'verificationcriteria', 'safetylevel', 'level', 'attach', 'proposal', 'object', 'feature', 'nonengineeringfeature'],

  // .fun - Functions (FUN_KEYWORDS)
  functionset: ['name', 'description', 'owner', 'tags', 'attach'],
  function: ['name', 'description', 'owner', 'tags', 'attach'],

  // .tst - Test cases (TST_KEYWORDS)
  testcaseset: ['name', 'description', 'owner', 'tags'],
  testcase: ['name', 'description', 'owner', 'tags', 'expected', 'passcriteria', 'steps', 'setup', 'attach'],

  // .blk - Blocks (BLK_KEYWORDS)
  //blockset: ['name', 'description', 'owner', 'tags', 'designrationale', 'modelfile', 'mass', 'volume', 'centerofmass', 'attach'],
  //block: ['name', 'description', 'owner', 'tags', 'designrationale', 'modelfile', 'mass', 'volume', 'centerofmass', 'materialname', 'density', 'youngsmodulus', 'poissonratio', 'yieldstrength', 'ultimatestrength', 'attach'],
  block: ['name', 'description', 'owner', 'tags', 'designrationale', 'attach'],
  //characteristic: ['name', 'description', 'owner', 'tags', 'unit', 'nominalvalue', 'upperlimit', 'lowerlimit', 'tolerance', 'controlmethod', 'measuringequipment', 'samplingplan', 'inspectionfrequency', 'documentreference', 'value'],
  //parameter: ['name', 'description', 'owner', 'tags', 'value', 'unit'],

  // .ifc - Interfaces (IFC_KEYWORDS)
  interfaceset: ['name', 'description', 'owner', 'tags'],
  operation: ['name', 'description', 'owner', 'tags', 'attach'],
  signal: ['name', 'description', 'owner', 'tags', 'attach'],
  datatype: ['name', 'description', 'owner', 'tags', 'attach'],
  parameter: ['name', 'description', 'owner', 'tags', 'value', 'unit', 'attach'],

  // .flr - Failure modes (FLR_KEYWORDS)
  failureset: ['name', 'description', 'owner', 'tags', 'attach'],
  failuremode: ['name', 'description', 'owner', 'tags', 'failurerate', 'severity', 'detectability', 'occurrence', 'probability', 'rpn', 'diagnosticcoverage', 'faultdetectiontime', 'faulttolerancetime', 'propagationdelay', 'recoverytime', 'attach', 'errorcode', 'dtc'],

  // .sgl - Safety goals (SGL_KEYWORDS)
  safetygoalset: ['name', 'description', 'owner', 'tags'],
  safetygoal: ['name', 'description', 'owner', 'tags', 'safestate', 'safecondition', 'faulttoleranttime', 'emergencyoperationtime'],

  // .sam - Safety mechanisms (SAM_KEYWORDS)
  safetymechanismset: ['name', 'description', 'owner', 'tags', 'iso26262part'],
  safetymechanism: ['name', 'description', 'owner', 'tags', 'safetymechanismeffectiveness', 'detectiontime', 'reactiontime'],

  // .fta - Fault trees (FTA_KEYWORDS)
  faulttree: ['name', 'description', 'owner', 'tags'],
  gate: ['name', 'description', 'owner', 'tags'],

  // .agt - Agents (AGT_KEYWORDS)
  agentset: ['name', 'description', 'owner'],
  agent: ['name', 'description', 'owner', 'role', 'specialization', 'expertise', 'context'],

  // .ucd - Use cases (UCD_KEYWORDS)
  usecaseset: ['name', 'description', 'owner', 'tags'],
  actor: ['name', 'description', 'owner', 'tags'],
  usecase: ['name', 'description', 'owner', 'tags'],

  // .seq - Sequences (SEQ_KEYWORDS)
  sequenceset: ['name', 'description', 'owner', 'tags'],
  sequence: ['name', 'description', 'owner', 'tags'],
  fragment: ['name', 'description', 'owner', 'tags', 'condition'],

  // .spr - Sprint (SPR_KEYWORDS)
  sprint: ['name', 'description', 'owner', 'startdate', 'enddate'],
  epic: ['name', 'description', 'owner', 'points', 'outputfile', 'comment', 'assignedto'],
  story: ['name', 'description', 'owner', 'points', 'outputfile', 'comment', 'assignedto'],
  task: ['name', 'description', 'owner', 'points', 'outputfile', 'comment', 'assignedto'],

  // .itm - Item definition (ITM_KEYWORDS)
  itemdefinition: ['name', 'description', 'owner', 'tags', 'iso26262part', 'conditions'],
  boundary: ['name', 'description', 'owner', 'tags'],
  operatingmode: ['name', 'description', 'owner', 'tags'],

  // .haz - Hazard analysis (HAZ_KEYWORDS)
  hazardanalysis: ['name', 'description', 'owner', 'tags', 'iso26262part', 'assessmentdate', 'hazardclass', 'speed', 'environment', 'trafficdensity', 'maxacceptabledelay', 'nominalresponsetime'],
  hazard: ['name', 'description', 'owner', 'tags'],
  situation: ['name', 'description', 'owner', 'tags'],

  // .smd - State machine (SMD_KEYWORDS)
  statemachine: ['name', 'description', 'owner', 'tags'],
  state: ['name', 'description', 'owner', 'tags'],
  transition: ['name', 'description', 'owner', 'tags', 'condition'],

  // .fml - Feature model (FML_KEYWORDS)
  featureset: ['name', 'description', 'owner', 'tags', 'attach'],
  feature: ['name', 'description', 'owner', 'tags', 'attach'],

  // .vml - Variants (VML_KEYWORDS)
  variantset: ['name', 'description', 'owner', 'tags'],
  variant: ['name', 'description', 'owner', 'tags'],

  // .vcf - Config (VCF_KEYWORDS)
  configset: ['name', 'description', 'owner', 'tags', 'generatedat'],
  config: ['name', 'description', 'owner', 'tags'],


}

// =============================================================================
// BLOCK ENUM MAPPINGS
// Maps which enums are allowed per block type
// Extracted from keywords.ts - each block has enums relevant to its file type
// =============================================================================

export const BLOCK_ENUMS: Record<string, string[]> = {
  // .req - Requirements (REQ_KEYWORDS)
  requirementset: ['level', 'safetylevel'],
  requirement: ['level', 'safetylevel', 'status', 'infotype', 'reqtype'],

  // .fun - Functions (FUN_KEYWORDS)
  functionset: ['level', 'safetylevel', 'status'],
  function: ['level', 'safetylevel', 'functiontype', 'status'],

  // .tst - Test cases (TST_KEYWORDS)
  testcaseset: ['level', 'safetylevel', 'status'],
  testcase: ['level', 'safetylevel', 'status', 'testresult', 'method'],

  // .blk - Blocks (BLK_KEYWORDS)
  //blockset: ['level', 'safetylevel', 'status'],
  block: ['level', 'safetylevel', 'blocktype', 'status'],
  //characteristic: ['chartype'],
  //parameter: [],

  // .ifc - Interfaces (IFC_KEYWORDS)
  interfaceset: ['safetylevel', 'level', 'status'],
  operation: ['safetylevel', 'level', 'status'],
  signal: ['safetylevel', 'level', 'status'],
  datatype: ['safetylevel', 'level', 'status'],
  parameter: ['safetylevel', 'level', 'status'],

  // .flr - Failure modes (FLR_KEYWORDS)
  failureset: ['safetylevel', 'level', 'status'],
  failuremode: ['safetylevel', 'level', 'actionpriority', 'timingreference', 'status'],

  // .sgl - Safety goals (SGL_KEYWORDS)
  safetygoalset: ['level', 'safetylevel', 'status'],
  safetygoal: ['level', 'safetylevel', 'status'],

  // .sam - Safety mechanisms (SAM_KEYWORDS)
  safetymechanismset: ['level', 'mechanismtype', 'status'],
  safetymechanism: ['level', 'mechanismtype', 'status'],

  // .fta - Fault trees (FTA_KEYWORDS)
  faulttree: ['level', 'status'],
  gate: ['level', 'gatetype', 'status'],

  // .agt - Agents (AGT_KEYWORDS)
  agentset: ['level'],
  agent: ['level'],

  // .ucd - Use cases (UCD_KEYWORDS)
  usecaseset: ['level', 'status'],
  actor: ['level', 'actortype', 'status'],
  usecase: ['level', 'connection', 'status'],

  // .seq - Sequences (SEQ_KEYWORDS)
  sequenceset: ['level', 'safetylevel', 'status'],
  sequence: ['level', 'safetylevel', 'status'],
  fragment: ['level', 'safetylevel', 'fragmenttype', 'status'],

  // .spr - Sprint (SPR_KEYWORDS)
  sprint: ['level'],
  epic: ['level', 'issuestatus', 'priority'],
  story: ['level', 'issuestatus', 'priority'],
  task: ['level', 'issuestatus', 'priority'],

  // .itm - Item definition (ITM_KEYWORDS)
  itemdefinition: ['level', 'status'],
  boundary: ['level', 'status'],
  operatingmode: ['level', 'status'],

  // .haz - Hazard analysis (HAZ_KEYWORDS)
  hazardanalysis: ['level', 'severity', 'exposure', 'controllability', 'status', 'asil'],
  hazard: ['level', 'severity', 'exposure', 'controllability', 'status', 'asil'],
  situation: ['level', 'severity', 'exposure', 'controllability', 'status', 'asil'],

  // .smd - State machine (SMD_KEYWORDS)
  statemachine: ['level', 'status'],
  state: ['level', 'status'],
  transition: ['level', 'status'],

  // .fml - Feature model (FML_KEYWORDS)
  featureset: ['level', 'safetylevel', 'status'],
  feature: ['level', 'safetylevel', 'status'],

  // .vml - Variants (VML_KEYWORDS)
  variantset: ['level', 'status'],
  variant: ['level', 'status'],

  // .vcf - Config (VCF_KEYWORDS)
  configset: ['status'],
  config: ['status'],


}


// =============================================================================
// GETTER FUNCTIONS FOR BLOCK PROPERTIES/ENUMS
// =============================================================================

export function getAllowedProperties(blockType: string): string[] {
  const bt = normalizeType(blockType)
  return BLOCK_PROPERTIES[bt] || []
}

export function getAllowedEnums(blockType: string): string[] {
  const bt = normalizeType(blockType)
  return BLOCK_ENUMS[bt] || []
}
