// Sylang Keywords Management System
// This file defines all allowed keywords for each Sylang file extension
// Keywords are categorized by type for better validation and autocomplete

export enum KeywordType {
    HEADER_DEFINITION = 'header-definition',
    DEFINITION = 'definition',
    PROPERTY = 'property',
    RELATION = 'relation',
    REFERENCE = 'reference',

    ENUM = 'enum',
    OPTIONAL_FLAG = 'optional-flag',
    CONFIG = 'config',
    CALL = 'call',
    TEMPORAL = 'temporal'
}

export interface Keyword {
    name: string;
    type: KeywordType;
    description: string;
    required?: boolean;
    allowMultiple?: boolean;
}

export interface FileTypeKeywords {
    fileExtension: string;
    displayName: string;
    allowedKeywords: Keyword[];
    requiredKeywords: string[];
    headerKeyword: string;
}

// Extensible enum values system
export interface EnumDefinition {
    name: string;
    values: string[];
    description: string;

}

// Predefined enum values - EXTENSIBLE ARRAY as requested
export const SYLANG_ENUMS: EnumDefinition[] = [
    {
        name: 'safetylevel',
        values: ['ASIL-A', 'ASIL-B', 'ASIL-C', 'ASIL-D', 'QM', 'SIL-1', 'SIL-2', 'SIL-3', 'SIL-4'],
        description: 'Safety integrity levels for automotive and general systems'
    },
    {
        name: 'chartype',
        values: ['special', 'critical', 'significant'],
        description: 'AIAG VDA product characteristic types'
    },
    {
        name: 'level',
        values: ['product', 'system', 'subsystem', 'component', 'subcomponent', 'module', 'submodule', 'part', 'subpart', 'solution', 'solutionelement', 'external', 'customer', 'supplier', 'object', 'objectelement', 'buildingblock', 'function', 'externalstakeholder', 'internalstakeholder', 'vehicle', 'sys1', 'sys2', 'sys3', 'sys4', 'sys5', 'hwe1', 'hwe2', 'hwe3', 'hwe4', 'swe1', 'swe2', 'swe3', 'swe4', 'swe5', 'swe6'],
        description: 'Hierarchical levels for system design and feature models (includes functiontype and blocktype values, stakeholder levels, and V-model levels)'
    },

    {
        name: 'status',
        values: ['draft', 'review', 'approved', 'deprecated', 'implemented', 'accepted', 'rejected', 'accepted+proposal', 'notapplicable', 'unknown'],
        description: 'Status values for requirements and other artifacts'
    },
    {
        name: 'reqtype',
        values: ['functional', 'nonfunctional', 'system', 'software', 'hardware', 'interface', 'safety', 'stakeholder', 'process', 'compliance', 'quality', 'IT', 'manufacturing', 'supplier', 'program', 'others'],
        description: 'Types of requirements'
    },
    {
        name: 'testresult',
        values: ['pass', 'fail', 'intest', 'notrun', 'blocked'],
        description: 'Test execution results'
    },
    {
        name: 'method',
        values: ['MIL', 'SIL', 'PIL', 'HIL', 'VIL', 'manual', 'automated'],
        description: 'Testing methods and approaches'
    },
    {
        name: 'issuestatus',
        values: ['backlog', 'open', 'inprogress', 'blocked', 'canceled', 'done'],
        description: 'Issue status values for sprint tasks'
    },
    {
        name: 'priority',
        values: ['low', 'medium', 'high', 'critical'],
        description: 'Priority levels for sprint tasks'
    },
    {
        name: 'actortype',
        values: ['primary', 'secondary'],
        description: 'Actor types for use case diagrams'
    },
    {
        name: 'fragmenttype',
        values: ['alt', 'else', 'parallel', 'loop'],
        description: 'Fragment types for sequence diagrams'
    },
    {
        name: 'actionpriority',
        values: ['high', 'medium', 'low'],
        description: 'AIAG VDA action priority levels'
    },
    {
        name: 'severity',
        values: ['S0', 'S1', 'S2', 'S3'],
        description: 'ISO 26262 severity ratings for hazard analysis'
    },
    {
        name: 'exposure',
        values: ['E0', 'E1', 'E2', 'E3', 'E4', 'E5'],
        description: 'ISO 26262 exposure ratings for hazard analysis'
    },
    {
        name: 'controllability',
        values: ['C0', 'C1', 'C2', 'C3'],
        description: 'ISO 26262 controllability ratings for hazard analysis'
    },
    {
        name: 'mechanismtype',
        values: ['redundancy', 'monitoring', 'diagnostic', 'degradation', 'validation'],
        description: 'Types of safety mechanisms'
    },
    {
        name: 'gatetype',
        values: ['and', 'or', 'xor', 'inhibit'],
        description: 'Fault tree gate types'
    },
    {
        name: 'connection',
        values: ['associated', 'includes'],
        description: 'Use case diagram connection types'
    },
    {
        name: 'timingreference',
        values: ['s', 'ms', 'us', 'ns'],
        description: 'Timing reference units for FMEA temporal constraints'
    },
    {
        name: 'functiontype',
        values: ['solution', 'function', 'solutionelement'],
        description: 'Function types for functional hierarchy'
    },
    {
        name: 'blocktype',
        values: ['object', 'objectelement', 'buildingblock', 'component', 'part'],
        description: 'Block types for hardware/software architecture'
    },
    {
        name: 'metrictype',
        values: ['count', 'percentage', 'sum', 'avg', 'min', 'max', 'gauge', 'trend'],
        description: 'Metric types for dashboard widgets'
    },
    {
        name: 'charttype',
        values: ['bar', 'line', 'pie', 'scatter', 'gauge'],
        description: 'Chart types for dashboard widgets'
    },
    {
        name: 'infotype',
        values: ['heading', 'content', 'note'],
        description: 'Information content types for non-requirement items in requirement documents'
    },
    // Note: 'nodetype' enum removed - .spec/.dash files now use filepath strings for source references
];

// .ple file keywords
const PLE_KEYWORDS: Keyword[] = [
    { name: 'hdef', type: KeywordType.HEADER_DEFINITION, description: 'Header definition for product line', required: true },
    { name: 'productline', type: KeywordType.HEADER_DEFINITION, description: 'Product line identifier' },
    { name: 'name', type: KeywordType.PROPERTY, description: 'Name property', allowMultiple: false },
    { name: 'description', type: KeywordType.PROPERTY, description: 'Description property' },
    { name: 'owner', type: KeywordType.PROPERTY, description: 'Owner property', allowMultiple: false },
    { name: 'domain', type: KeywordType.PROPERTY, description: 'Domain property', allowMultiple: true },
    { name: 'compliance', type: KeywordType.PROPERTY, description: 'Compliance standards', allowMultiple: true },
    { name: 'firstrelease', type: KeywordType.PROPERTY, description: 'First release date', allowMultiple: false },
    { name: 'tags', type: KeywordType.PROPERTY, description: 'Tags property', allowMultiple: true },
    { name: 'safetylevel', type: KeywordType.ENUM, description: 'Safety level enum' },
    { name: 'status', type: KeywordType.ENUM, description: 'Status enum' },
    { name: 'region', type: KeywordType.PROPERTY, description: 'Target regions', allowMultiple: true }
];

// .fml file keywords
const FML_KEYWORDS: Keyword[] = [
    { name: 'use', type: KeywordType.REFERENCE, description: 'Import statement', allowMultiple: true },
    { name: 'hdef', type: KeywordType.HEADER_DEFINITION, description: 'Header definition for feature set', required: true },
    { name: 'featureset', type: KeywordType.HEADER_DEFINITION, description: 'Feature set identifier' },
    { name: 'listedfor', type: KeywordType.RELATION, description: 'Listed for relation', allowMultiple: true },
    { name: 'name', type: KeywordType.PROPERTY, description: 'Name property' },
    { name: 'description', type: KeywordType.PROPERTY, description: 'Description property' },
    { name: 'owner', type: KeywordType.PROPERTY, description: 'Owner property' },
    { name: 'tags', type: KeywordType.PROPERTY, description: 'Tags property', allowMultiple: true },
    { name: 'level', type: KeywordType.ENUM, description: 'Hierarchical level enum' },
    { name: 'safetylevel', type: KeywordType.ENUM, description: 'Safety level enum' },
    { name: 'status', type: KeywordType.ENUM, description: 'Status enum' },
    { name: 'def', type: KeywordType.DEFINITION, description: 'Definition keyword', allowMultiple: true },
    { name: 'feature', type: KeywordType.DEFINITION, description: 'Feature definition' },
    { name: 'mandatory', type: KeywordType.OPTIONAL_FLAG, description: 'Mandatory flag' },
    { name: 'optional', type: KeywordType.OPTIONAL_FLAG, description: 'Optional flag' },
    { name: 'or', type: KeywordType.OPTIONAL_FLAG, description: 'Or flag' },
    { name: 'alternative', type: KeywordType.OPTIONAL_FLAG, description: 'Alternative flag' },
    { name: 'requires', type: KeywordType.RELATION, description: 'Requires relation for parameter references', allowMultiple: true },
    { name: 'excludes', type: KeywordType.RELATION, description: 'Excludes relation', allowMultiple: true },
    { name: 'performs', type: KeywordType.RELATION, description: 'Performs relation - feature performs functions', allowMultiple: true },
    { name: 'needs', type: KeywordType.RELATION, description: 'Needs relation - feature needs operations/signals', allowMultiple: true },
    { name: 'provides', type: KeywordType.RELATION, description: 'Provides relation - feature provides operations/signals', allowMultiple: true },
    { name: 'meets', type: KeywordType.RELATION, description: 'Meets relation for characteristic or safetygoal references', allowMultiple: true },
    { name: 'ref', type: KeywordType.REFERENCE, description: 'Reference keyword' },
    { name: 'productline', type: KeywordType.REFERENCE, description: 'Product line reference' },
    { name: 'function', type: KeywordType.REFERENCE, description: 'Function reference' },
    { name: 'characteristic', type: KeywordType.REFERENCE, description: 'Characteristic reference' },
    { name: 'operation', type: KeywordType.REFERENCE, description: 'Operation reference' },
    { name: 'signal', type: KeywordType.REFERENCE, description: 'Signal reference' },
    { name: 'interfaceset', type: KeywordType.REFERENCE, description: 'Interface set reference' },
    { name: 'inherits', type: KeywordType.RELATION, description: 'Inherits relation', allowMultiple: true },
    { name: 'attach', type: KeywordType.PROPERTY, description: 'Attachment file path or URL' }
];

// .vml file keywords
const VML_KEYWORDS: Keyword[] = [
    { name: 'use', type: KeywordType.REFERENCE, description: 'Import statement', allowMultiple: true },
    { name: 'hdef', type: KeywordType.HEADER_DEFINITION, description: 'Header definition for variant set', required: true },
    { name: 'variantset', type: KeywordType.HEADER_DEFINITION, description: 'Variant set identifier' },
    { name: 'name', type: KeywordType.PROPERTY, description: 'Name property' },
    { name: 'description', type: KeywordType.PROPERTY, description: 'Description property' },
    { name: 'owner', type: KeywordType.PROPERTY, description: 'Owner property' },
    { name: 'tags', type: KeywordType.PROPERTY, description: 'Tags property', allowMultiple: true },
    { name: 'level', type: KeywordType.ENUM, description: 'Hierarchical level enum' },
    { name: 'status', type: KeywordType.ENUM, description: 'Status enum' },
    { name: 'ref', type: KeywordType.REFERENCE, description: 'Reference keyword' },
    { name: 'feature', type: KeywordType.REFERENCE, description: 'Feature reference' },
    { name: 'extends', type: KeywordType.RELATION, description: 'Extends relation', allowMultiple: true },
    { name: 'mandatory', type: KeywordType.OPTIONAL_FLAG, description: 'Mandatory flag' },
    { name: 'optional', type: KeywordType.OPTIONAL_FLAG, description: 'Optional flag' },
    { name: 'or', type: KeywordType.OPTIONAL_FLAG, description: 'Or flag' },
    { name: 'alternative', type: KeywordType.OPTIONAL_FLAG, description: 'Alternative flag' },
    { name: 'selected', type: KeywordType.OPTIONAL_FLAG, description: 'Selected flag' },
    { name: 'featureset', type: KeywordType.REFERENCE, description: 'Feature set reference' },
    { name: 'inherits', type: KeywordType.RELATION, description: 'Inherits relation', allowMultiple: true }
];

// .vcf file keywords  
const VCF_KEYWORDS: Keyword[] = [
    { name: 'use', type: KeywordType.REFERENCE, description: 'Import statement', allowMultiple: true },
    { name: 'hdef', type: KeywordType.HEADER_DEFINITION, description: 'Header definition for config set', required: true },
    { name: 'configset', type: KeywordType.HEADER_DEFINITION, description: 'Config set identifier' },
    { name: 'generatedfrom', type: KeywordType.RELATION, description: 'Generated from relation', allowMultiple: true },
    { name: 'generatedat', type: KeywordType.PROPERTY, description: 'Generation timestamp' },
    { name: 'name', type: KeywordType.PROPERTY, description: 'Name property' },
    { name: 'description', type: KeywordType.PROPERTY, description: 'Description property' },
    { name: 'owner', type: KeywordType.PROPERTY, description: 'Owner property' },
    { name: 'tags', type: KeywordType.PROPERTY, description: 'Tags property', allowMultiple: true },
    { name: 'status', type: KeywordType.ENUM, description: 'Status enum' },
    { name: 'def', type: KeywordType.DEFINITION, description: 'Definition keyword', allowMultiple: true },
    { name: 'config', type: KeywordType.CONFIG, description: 'Config definition' },
    { name: 'basedon', type: KeywordType.RELATION, description: 'Based on relation for config feature reference', allowMultiple: true },
    { name: 'feature', type: KeywordType.REFERENCE, description: 'Feature reference' },
    { name: 'variantset', type: KeywordType.REFERENCE, description: 'Variant set reference' },
    { name: 'inherits', type: KeywordType.RELATION, description: 'Inherits relation', allowMultiple: true }
];

// .fun file keywords
const FUN_KEYWORDS: Keyword[] = [
    { name: 'use', type: KeywordType.REFERENCE, description: 'Import statement', allowMultiple: true },
    { name: 'hdef', type: KeywordType.HEADER_DEFINITION, description: 'Header definition for function set', required: true },
    { name: 'functionset', type: KeywordType.HEADER_DEFINITION, description: 'Function set identifier' },
    { name: 'name', type: KeywordType.PROPERTY, description: 'Name property' },
    { name: 'description', type: KeywordType.PROPERTY, description: 'Description property' },
    { name: 'owner', type: KeywordType.PROPERTY, description: 'Owner property' },
    { name: 'tags', type: KeywordType.PROPERTY, description: 'Tags property', allowMultiple: true },
    { name: 'level', type: KeywordType.ENUM, description: 'Hierarchical level enum (system, subsystem, module, part)' },
    { name: 'safetylevel', type: KeywordType.ENUM, description: 'Safety level enum' },
    { name: 'functiontype', type: KeywordType.ENUM, description: 'Function type enum (solution, function, solutionelement)' },
    { name: 'status', type: KeywordType.ENUM, description: 'Status enum' },
    { name: 'def', type: KeywordType.DEFINITION, description: 'Definition keyword', allowMultiple: true },
    { name: 'function', type: KeywordType.DEFINITION, description: 'Function definition' },
    { name: 'enables', type: KeywordType.RELATION, description: 'Enables relation', allowMultiple: true },
    { name: 'decomposesto', type: KeywordType.RELATION, description: 'Decomposes to relation for top-down function breakdown (AIAG VDA function networks)', allowMultiple: true },
    { name: 'decomposedfrom', type: KeywordType.RELATION, description: 'Decomposes from relation for bottom-up function composition', allowMultiple: true },
    { name: 'needs', type: KeywordType.RELATION, description: 'Needs relation for required operations/signals', allowMultiple: true },
    { name: 'provides', type: KeywordType.RELATION, description: 'Provides relation for provided operations/signals', allowMultiple: true },
    { name: 'requires', type: KeywordType.RELATION, description: 'Requires relation for parameter references', allowMultiple: true },
    { name: 'meets', type: KeywordType.RELATION, description: 'Meets relation for characteristic or safetygoal references', allowMultiple: true },
    { name: 'derivedfrom', type: KeywordType.RELATION, description: 'Derived from requirement relation (ASPICE bilateral traceability)', allowMultiple: true },
    { name: 'implementedby', type: KeywordType.RELATION, description: 'Implemented by requirement relation (ASPICE bilateral traceability)', allowMultiple: true },
    { name: 'detects', type: KeywordType.RELATION, description: 'Detects malfunction/failure relation (safety diagnostics)', allowMultiple: true },
    { name: 'feature', type: KeywordType.REFERENCE, description: 'Feature reference' },
    { name: 'characteristic', type: KeywordType.REFERENCE, description: 'Characteristic reference' },
    { name: 'requirement', type: KeywordType.REFERENCE, description: 'Requirement reference' },
    { name: 'malfunction', type: KeywordType.REFERENCE, description: 'Malfunction reference' },
    { name: 'failure', type: KeywordType.REFERENCE, description: 'Failure mode reference' },
    { name: 'failuremode', type: KeywordType.REFERENCE, description: 'Failure mode reference (alias)' },
    { name: 'allocatedto', type: KeywordType.RELATION, description: 'Allocated to relation', allowMultiple: true },
    { name: 'block', type: KeywordType.REFERENCE, description: 'Block reference' },
    { name: 'ref', type: KeywordType.REFERENCE, description: 'Reference keyword' },
    { name: 'config', type: KeywordType.CONFIG, description: 'Config reference' },
    { name: 'when', type: KeywordType.RELATION, description: 'When relation for conditional config references', allowMultiple: true },
    { name: 'featureset', type: KeywordType.REFERENCE, description: 'Feature set reference' },
    { name: 'configset', type: KeywordType.REFERENCE, description: 'Config set reference' },
    { name: 'attach', type: KeywordType.PROPERTY, description: 'Attachment file path or URL' },
    // Effort estimation properties
    { name: 'analysiseffort', type: KeywordType.PROPERTY, description: 'Analysis effort in hours' },
    { name: 'deveffort', type: KeywordType.PROPERTY, description: 'Development effort in hours' },
    { name: 'testeffort', type: KeywordType.PROPERTY, description: 'Test effort in hours' }
];

// .req file keywords
const REQ_KEYWORDS: Keyword[] = [
    { name: 'use', type: KeywordType.REFERENCE, description: 'Import statement', allowMultiple: true },
    { name: 'hdef', type: KeywordType.HEADER_DEFINITION, description: 'Header definition for requirement set', required: true },
    { name: 'requirementset', type: KeywordType.HEADER_DEFINITION, description: 'Requirement set identifier' },
    { name: 'name', type: KeywordType.PROPERTY, description: 'Name property' },
    { name: 'description', type: KeywordType.PROPERTY, description: 'Description property' },
    { name: 'owner', type: KeywordType.PROPERTY, description: 'Owner property' },
    { name: 'tags', type: KeywordType.PROPERTY, description: 'Tags property', allowMultiple: true },
    { name: 'level', type: KeywordType.ENUM, description: 'Hierarchical level enum (system, subsystem, module, part)' },
    { name: 'safetylevel', type: KeywordType.ENUM, description: 'Safety level enum' },
    { name: 'def', type: KeywordType.DEFINITION, description: 'Definition keyword', allowMultiple: true },
    { name: 'requirement', type: KeywordType.DEFINITION, description: 'Requirement definition' },
    //  { name: 'information', type: KeywordType.DEFINITION, description: 'Information content definition (headings, notes, commentary)' },
    { name: 'infotype', type: KeywordType.ENUM, description: 'Information type enum (heading, content, note)' },
    { name: 'headinglevel', type: KeywordType.PROPERTY, description: 'Heading level for information nodes (1-6)', allowMultiple: false },
    { name: 'refinedfrom', type: KeywordType.RELATION, description: 'Refined from relation', allowMultiple: true },
    { name: 'derivedfrom', type: KeywordType.RELATION, description: 'Derived from relation', allowMultiple: true },
    { name: 'implements', type: KeywordType.RELATION, description: 'Implements relation', allowMultiple: true },
    { name: 'function', type: KeywordType.REFERENCE, description: 'Function reference' },
    { name: 'allocatedto', type: KeywordType.RELATION, description: 'Allocated to relation', allowMultiple: true },
    { name: 'block', type: KeywordType.REFERENCE, description: 'Block reference' },
    { name: 'ref', type: KeywordType.REFERENCE, description: 'Reference keyword' },
    { name: 'config', type: KeywordType.CONFIG, description: 'Config reference' },
    { name: 'when', type: KeywordType.RELATION, description: 'When relation for conditional config references', allowMultiple: true },
    { name: 'requires', type: KeywordType.RELATION, description: 'Requires relation for parameter/datatype references', allowMultiple: true },
    { name: 'meets', type: KeywordType.RELATION, description: 'Meets relation for characteristic or safetygoal references', allowMultiple: true },
    { name: 'parameter', type: KeywordType.REFERENCE, description: 'Parameter reference' },
    { name: 'characteristic', type: KeywordType.REFERENCE, description: 'Characteristic reference' },
    { name: 'rationale', type: KeywordType.PROPERTY, description: 'Rationale property' },
    { name: 'verificationcriteria', type: KeywordType.PROPERTY, description: 'Verification criteria property' },
    { name: 'status', type: KeywordType.ENUM, description: 'Status enum' },
    { name: 'reqtype', type: KeywordType.ENUM, description: 'Requirement type enum' },
    { name: 'functiongroup', type: KeywordType.REFERENCE, description: 'Function group reference' },
    { name: 'configset', type: KeywordType.REFERENCE, description: 'Config set reference' },
    { name: 'attach', type: KeywordType.PROPERTY, description: 'Attachment file path or URL' },
    { name: 'proposal', type: KeywordType.PROPERTY, description: 'Proposal identifier for requirement' },
    // Traceability references
    { name: 'object', type: KeywordType.PROPERTY, description: 'Object reference for requirement traceability' },
    { name: 'feature', type: KeywordType.PROPERTY, description: 'Feature reference for requirement traceability' },
    { name: 'nonengineeringfeature', type: KeywordType.PROPERTY, description: 'Non-engineering feature reference for requirement traceability' },
    // Effort estimation properties
    { name: 'analysiseffort', type: KeywordType.PROPERTY, description: 'Analysis effort in hours' },
    { name: 'deveffort', type: KeywordType.PROPERTY, description: 'Development effort in hours' },
    { name: 'testeffort', type: KeywordType.PROPERTY, description: 'Test effort in hours' }
];

// .tst file keywords
const TST_KEYWORDS: Keyword[] = [
    { name: 'use', type: KeywordType.REFERENCE, description: 'Import statement', allowMultiple: true },
    { name: 'hdef', type: KeywordType.HEADER_DEFINITION, description: 'Header definition for test set', required: true },
    { name: 'testset', type: KeywordType.HEADER_DEFINITION, description: 'Test set identifier' },
    { name: 'name', type: KeywordType.PROPERTY, description: 'Name property' },
    { name: 'description', type: KeywordType.PROPERTY, description: 'Description property' },
    { name: 'owner', type: KeywordType.PROPERTY, description: 'Owner property' },
    { name: 'tags', type: KeywordType.PROPERTY, description: 'Tags property', allowMultiple: true },
    { name: 'level', type: KeywordType.ENUM, description: 'Hierarchical level enum (system, subsystem, module, part)' },
    { name: 'safetylevel', type: KeywordType.ENUM, description: 'Safety level enum' },
    { name: 'status', type: KeywordType.ENUM, description: 'Status enum' },
    { name: 'def', type: KeywordType.DEFINITION, description: 'Definition keyword', allowMultiple: true },
    { name: 'testcase', type: KeywordType.DEFINITION, description: 'Test case definition' },
    { name: 'refinedfrom', type: KeywordType.RELATION, description: 'Refined from relation', allowMultiple: true },
    { name: 'derivedfrom', type: KeywordType.RELATION, description: 'Derived from relation', allowMultiple: true },
    { name: 'requirement', type: KeywordType.REFERENCE, description: 'Requirement reference' },
    { name: 'satisfies', type: KeywordType.RELATION, description: 'Satisfies relation', allowMultiple: true },
    { name: 'ref', type: KeywordType.REFERENCE, description: 'Reference keyword' },
    { name: 'config', type: KeywordType.CONFIG, description: 'Config reference' },
    { name: 'when', type: KeywordType.RELATION, description: 'When relation for conditional config references', allowMultiple: true },
    { name: 'requires', type: KeywordType.RELATION, description: 'Requires relation for parameter/datatype references', allowMultiple: true },
    { name: 'meets', type: KeywordType.RELATION, description: 'Meets relation for characteristic or safetygoal references', allowMultiple: true },
    { name: 'parameter', type: KeywordType.REFERENCE, description: 'Parameter reference' },
    { name: 'characteristic', type: KeywordType.REFERENCE, description: 'Characteristic reference' },
    { name: 'expected', type: KeywordType.PROPERTY, description: 'Expected result property' },
    { name: 'passcriteria', type: KeywordType.PROPERTY, description: 'Pass criteria property' },
    { name: 'testresult', type: KeywordType.ENUM, description: 'Test result enum' },
    { name: 'steps', type: KeywordType.PROPERTY, description: 'Test steps property (multi-line string)' },
    { name: 'method', type: KeywordType.ENUM, description: 'Test method enum' },
    { name: 'setup', type: KeywordType.PROPERTY, description: 'Test setup property' },
    { name: 'requirementset', type: KeywordType.REFERENCE, description: 'Requirement set reference' },
    { name: 'configset', type: KeywordType.REFERENCE, description: 'Config set reference' },
    { name: 'attach', type: KeywordType.PROPERTY, description: 'Attachment file path or URL' },
    // Effort estimation properties
    { name: 'analysiseffort', type: KeywordType.PROPERTY, description: 'Analysis effort in hours' },
    { name: 'deveffort', type: KeywordType.PROPERTY, description: 'Development effort in hours' },
    { name: 'testeffort', type: KeywordType.PROPERTY, description: 'Test effort in hours' }
];

// .blk file keywords
const BLK_KEYWORDS: Keyword[] = [
    { name: 'use', type: KeywordType.REFERENCE, description: 'Import statement', allowMultiple: true },
    { name: 'hdef', type: KeywordType.HEADER_DEFINITION, description: 'Header definition for block', required: true },
    { name: 'block', type: KeywordType.HEADER_DEFINITION, description: 'Block identifier' },
    { name: 'name', type: KeywordType.PROPERTY, description: 'Name property' },
    { name: 'description', type: KeywordType.PROPERTY, description: 'Description property' },
    { name: 'designrationale', type: KeywordType.PROPERTY, description: 'Design rationale property' },
    { name: 'owner', type: KeywordType.PROPERTY, description: 'Owner property' },
    { name: 'tags', type: KeywordType.PROPERTY, description: 'Tags property', allowMultiple: true },
    { name: 'level', type: KeywordType.ENUM, description: 'Hierarchical level enum' },
    { name: 'safetylevel', type: KeywordType.ENUM, description: 'Safety level enum' },
    { name: 'blocktype', type: KeywordType.ENUM, description: 'Block type enum (object, objectelement, buildingblock, component, part)' },
    { name: 'status', type: KeywordType.ENUM, description: 'Status enum' },
    { name: 'modelfile', type: KeywordType.PROPERTY, description: 'Path to CAD model file (CadQuery .py script or .FCStd)' },
    { name: 'mass', type: KeywordType.PROPERTY, description: 'Part mass in kg (numeric value)' },
    { name: 'volume', type: KeywordType.PROPERTY, description: 'Part volume in cm³ (numeric value)' },
    { name: 'centerofmass', type: KeywordType.PROPERTY, description: 'Center of mass coordinates (x y z)' },
    { name: 'materialname', type: KeywordType.PROPERTY, description: 'Material name for characteristic' },
    { name: 'density', type: KeywordType.PROPERTY, description: 'Material density in kg/m³ (numeric value)' },
    { name: 'youngsmodulus', type: KeywordType.PROPERTY, description: 'Young\'s modulus in GPa (numeric value)' },
    { name: 'poissonratio', type: KeywordType.PROPERTY, description: 'Poisson\'s ratio (numeric value 0-0.5)' },
    { name: 'yieldstrength', type: KeywordType.PROPERTY, description: 'Yield strength in MPa (numeric value)' },
    { name: 'ultimatestrength', type: KeywordType.PROPERTY, description: 'Ultimate tensile strength in MPa (numeric value)' },
    { name: 'def', type: KeywordType.DEFINITION, description: 'Definition keyword', allowMultiple: true },
    { name: 'characteristic', type: KeywordType.DEFINITION, description: 'Product characteristic definition (AIAG VDA)' },
    { name: 'chartype', type: KeywordType.ENUM, description: 'Product characteristic type enum' },
    { name: 'unit', type: KeywordType.PROPERTY, description: 'Measurement unit (e.g., MPa, mm, kg, V, A)' },
    { name: 'nominalvalue', type: KeywordType.PROPERTY, description: 'Target/nominal numeric value (integer or float)' },
    { name: 'upperlimit', type: KeywordType.PROPERTY, description: 'Upper specification limit (USL) - numeric value' },
    { name: 'lowerlimit', type: KeywordType.PROPERTY, description: 'Lower specification limit (LSL) - numeric value' },
    { name: 'tolerance', type: KeywordType.PROPERTY, description: 'Tolerance value - numeric' },
    { name: 'controlmethod', type: KeywordType.PROPERTY, description: 'Control method for characteristic' },
    { name: 'measuringequipment', type: KeywordType.PROPERTY, description: 'Measuring equipment for characteristic' },
    { name: 'samplingplan', type: KeywordType.PROPERTY, description: 'Sampling strategy (e.g., AQL 1.0)' },
    { name: 'inspectionfrequency', type: KeywordType.PROPERTY, description: 'Inspection frequency (e.g., Every 100 parts)' },
    { name: 'documentreference', type: KeywordType.PROPERTY, description: 'Drawing/specification document reference' },
    { name: 'value', type: KeywordType.PROPERTY, description: 'Parameter value (string literal)' },
    { name: 'decomposedfrom', type: KeywordType.RELATION, description: 'Decomposes from relation for bottom-up block composition', allowMultiple: true },
    { name: 'decomposesto', type: KeywordType.RELATION, description: 'Decomposes to relation (replaces composedof)', allowMultiple: true },
    { name: 'implements', type: KeywordType.RELATION, description: 'Implements function relation', allowMultiple: true },
    { name: 'enables', type: KeywordType.RELATION, description: 'Enables feature relation', allowMultiple: true },
    { name: 'derivedfrom', type: KeywordType.RELATION, description: 'Derived from requirement relation (ASPICE bilateral traceability)', allowMultiple: true },
    { name: 'implementedby', type: KeywordType.RELATION, description: 'Implemented by requirement relation (ASPICE bilateral traceability)', allowMultiple: true },
    { name: 'needs', type: KeywordType.RELATION, description: 'Needs relation (input to block from other blocks)', allowMultiple: true },
    { name: 'provides', type: KeywordType.RELATION, description: 'Provides relation (output interface from block to external systems)', allowMultiple: true },
    { name: 'requires', type: KeywordType.RELATION, description: 'Requires relation for parameter references', allowMultiple: true },
    { name: 'meets', type: KeywordType.RELATION, description: 'Meets relation for characteristic or safetygoal references', allowMultiple: true },
    { name: 'verifiedby', type: KeywordType.RELATION, description: 'Verified by test case relation (for characteristics)', allowMultiple: true },
    { name: 'feature', type: KeywordType.REFERENCE, description: 'Feature reference' },
    { name: 'function', type: KeywordType.REFERENCE, description: 'Function reference' },
    { name: 'characteristic', type: KeywordType.REFERENCE, description: 'Characteristic reference' },
    { name: 'requirement', type: KeywordType.REFERENCE, description: 'Requirement reference' },
    { name: 'testcase', type: KeywordType.REFERENCE, description: 'Test case reference' },
    { name: 'ref', type: KeywordType.REFERENCE, description: 'Reference keyword' },
    { name: 'datatype', type: KeywordType.REFERENCE, description: 'Data type reference' },
    { name: 'config', type: KeywordType.CONFIG, description: 'Config reference' },
    { name: 'when', type: KeywordType.RELATION, description: 'When relation for conditional config references', allowMultiple: true },
    { name: 'featureset', type: KeywordType.REFERENCE, description: 'Feature set reference' },
    { name: 'functionset', type: KeywordType.REFERENCE, description: 'Function set reference' },
    { name: 'configset', type: KeywordType.REFERENCE, description: 'Config set reference' },
    { name: 'interfaceset', type: KeywordType.REFERENCE, description: 'Interface set reference' },
    { name: 'attach', type: KeywordType.PROPERTY, description: 'Attachment file path or URL' },
    // Effort estimation properties
    { name: 'analysiseffort', type: KeywordType.PROPERTY, description: 'Analysis effort in hours' },
    { name: 'deveffort', type: KeywordType.PROPERTY, description: 'Development effort in hours' },
    { name: 'testeffort', type: KeywordType.PROPERTY, description: 'Test effort in hours' }
];

// .spr file keywords
const SPR_KEYWORDS: Keyword[] = [
    { name: 'use', type: KeywordType.REFERENCE, description: 'Import statement', allowMultiple: true },
    { name: 'agentset', type: KeywordType.HEADER_DEFINITION, description: 'Agent set identifier for import' },
    { name: 'hdef', type: KeywordType.HEADER_DEFINITION, description: 'Header definition for sprint', required: true },
    { name: 'sprint', type: KeywordType.HEADER_DEFINITION, description: 'Sprint identifier' },
    { name: 'name', type: KeywordType.PROPERTY, description: 'Name property' },
    { name: 'description', type: KeywordType.PROPERTY, description: 'Description property' },
    { name: 'owner', type: KeywordType.PROPERTY, description: 'Owner property' },
    { name: 'level', type: KeywordType.ENUM, description: 'Hierarchical level enum' },
    { name: 'startdate', type: KeywordType.PROPERTY, description: 'Sprint start date' },
    { name: 'enddate', type: KeywordType.PROPERTY, description: 'Sprint end date' },
    { name: 'assignedto', type: KeywordType.RELATION, description: 'Assigned agent reference', allowMultiple: true },
    { name: 'ref', type: KeywordType.REFERENCE, description: 'Reference keyword' },
    { name: 'agent', type: KeywordType.REFERENCE, description: 'Agent reference' },
    { name: 'issuestatus', type: KeywordType.ENUM, description: 'Issue status enum (backlog, open, inprogress, blocked, canceled, done)' },
    { name: 'priority', type: KeywordType.ENUM, description: 'Priority enum (low, medium, high, critical)' },
    { name: 'points', type: KeywordType.PROPERTY, description: 'Story points for estimation' },
    { name: 'outputfile', type: KeywordType.PROPERTY, description: 'Expected output file from task' },
    { name: 'comment', type: KeywordType.PROPERTY, description: 'Comment property for sprint items' },
    { name: 'def', type: KeywordType.DEFINITION, description: 'Definition keyword', allowMultiple: true },
    { name: 'epic', type: KeywordType.DEFINITION, description: 'Epic definition' },
    { name: 'story', type: KeywordType.DEFINITION, description: 'Story definition' },
    { name: 'task', type: KeywordType.DEFINITION, description: 'Task definition' }
];

// .agt file keywords
const AGT_KEYWORDS: Keyword[] = [
    { name: 'use', type: KeywordType.REFERENCE, description: 'Import statement', allowMultiple: true },
    { name: 'hdef', type: KeywordType.HEADER_DEFINITION, description: 'Header definition for agent set', required: true },
    { name: 'agentset', type: KeywordType.HEADER_DEFINITION, description: 'Agent set identifier' },
    { name: 'name', type: KeywordType.PROPERTY, description: 'Name property' },
    { name: 'description', type: KeywordType.PROPERTY, description: 'Description property' },
    { name: 'owner', type: KeywordType.PROPERTY, description: 'Owner property' },
    { name: 'level', type: KeywordType.ENUM, description: 'Hierarchical level enum' },
    { name: 'def', type: KeywordType.DEFINITION, description: 'Definition keyword', allowMultiple: true },
    { name: 'agent', type: KeywordType.DEFINITION, description: 'Agent definition' },
    { name: 'role', type: KeywordType.PROPERTY, description: 'Agent role property' },
    { name: 'specialization', type: KeywordType.PROPERTY, description: 'Agent specialization property' },
    { name: 'expertise', type: KeywordType.PROPERTY, description: 'Agent expertise property', allowMultiple: true },
    { name: 'context', type: KeywordType.PROPERTY, description: 'Agent context property', allowMultiple: true }
];

// .ucd file keywords
const UCD_KEYWORDS: Keyword[] = [
    { name: 'use', type: KeywordType.REFERENCE, description: 'Import statement', allowMultiple: true },
    { name: 'hdef', type: KeywordType.HEADER_DEFINITION, description: 'Header definition for use case set', required: true },
    { name: 'usecaseset', type: KeywordType.HEADER_DEFINITION, description: 'Use case set identifier' },
    { name: 'name', type: KeywordType.PROPERTY, description: 'Name property' },
    { name: 'description', type: KeywordType.PROPERTY, description: 'Description property' },
    { name: 'owner', type: KeywordType.PROPERTY, description: 'Owner property' },
    { name: 'tags', type: KeywordType.PROPERTY, description: 'Tags property', allowMultiple: true },
    { name: 'level', type: KeywordType.ENUM, description: 'Hierarchical level enum (system, subsystem, module, part)' },
    { name: 'def', type: KeywordType.DEFINITION, description: 'Definition keyword', allowMultiple: true },
    { name: 'actor', type: KeywordType.DEFINITION, description: 'Actor definition' },
    { name: 'usecase', type: KeywordType.DEFINITION, description: 'Use case definition' },
    { name: 'actortype', type: KeywordType.ENUM, description: 'Actor type enum (primary, secondary)' },
    // NEW SYNTAX v2.21.44 - from/to/connection keywords
    { name: 'from', type: KeywordType.RELATION, description: 'Source of use case relationship', allowMultiple: true },
    { name: 'to', type: KeywordType.RELATION, description: 'Target of use case relationship', allowMultiple: true },
    { name: 'connection', type: KeywordType.ENUM, description: 'Connection type enum (associated, includes)' },
    // Legacy keywords for backward compatibility
    { name: 'associated', type: KeywordType.RELATION, description: 'Associated function relationship (solid line)', allowMultiple: true },
    { name: 'includes', type: KeywordType.RELATION, description: 'Includes function relationship (dotted line)', allowMultiple: true },
    { name: 'when', type: KeywordType.RELATION, description: 'Configuration condition', allowMultiple: true },
    { name: 'requires', type: KeywordType.RELATION, description: 'Requires relation for parameter/datatype references', allowMultiple: true },
    { name: 'ref', type: KeywordType.REFERENCE, description: 'Reference keyword' },
    { name: 'parameter', type: KeywordType.REFERENCE, description: 'Parameter reference' },
    { name: 'config', type: KeywordType.CONFIG, description: 'Config reference' },
    { name: 'function', type: KeywordType.REFERENCE, description: 'Function reference' }
];

// .seq file keywords  
const SEQ_KEYWORDS: Keyword[] = [
    { name: 'use', type: KeywordType.REFERENCE, description: 'Import statement', allowMultiple: true },
    { name: 'hdef', type: KeywordType.HEADER_DEFINITION, description: 'Header definition for sequence', required: true },
    { name: 'sequenceset', type: KeywordType.HEADER_DEFINITION, description: 'Sequence set identifier' },
    { name: 'functionset', type: KeywordType.REFERENCE, description: 'Function set reference' },
    { name: 'function', type: KeywordType.REFERENCE, description: 'Function reference' },
    { name: 'name', type: KeywordType.PROPERTY, description: 'Name property' },
    { name: 'description', type: KeywordType.PROPERTY, description: 'Description property' },
    { name: 'owner', type: KeywordType.PROPERTY, description: 'Owner property' },
    { name: 'tags', type: KeywordType.PROPERTY, description: 'Tags property', allowMultiple: true },
    { name: 'level', type: KeywordType.ENUM, description: 'Hierarchical level enum (system, subsystem, module, part)' },
    { name: 'safetylevel', type: KeywordType.ENUM, description: 'Safety level enum' },
    { name: 'def', type: KeywordType.DEFINITION, description: 'Definition keyword', allowMultiple: true },
    { name: 'sequence', type: KeywordType.DEFINITION, description: 'Sequence definition' },
    { name: 'block', type: KeywordType.DEFINITION, description: 'Block definition (changed from participant)' },
    { name: 'fragment', type: KeywordType.DEFINITION, description: 'Fragment definition (container for conditional logic)' },
    { name: 'from', type: KeywordType.RELATION, description: 'Source block or function relation', allowMultiple: true },
    { name: 'to', type: KeywordType.RELATION, description: 'Target block or function relation', allowMultiple: true },
    { name: 'flow', type: KeywordType.RELATION, description: 'Message/signal flow relation', allowMultiple: true },
    { name: 'fragmenttype', type: KeywordType.ENUM, description: 'Fragment type enum (alt, else, parallel, loop)' },
    { name: 'condition', type: KeywordType.PROPERTY, description: 'Fragment condition' },
    { name: 'when', type: KeywordType.RELATION, description: 'Configuration condition', allowMultiple: true },
    { name: 'requires', type: KeywordType.RELATION, description: 'Requires relation for parameter/datatype references', allowMultiple: true },
    { name: 'ref', type: KeywordType.REFERENCE, description: 'Reference keyword' },
    { name: 'operation', type: KeywordType.REFERENCE, description: 'Operation reference' },
    { name: 'signal', type: KeywordType.REFERENCE, description: 'Signal reference' },
    { name: 'parameter', type: KeywordType.REFERENCE, description: 'Parameter reference' }
];

// .flr file keywords
const FLR_KEYWORDS: Keyword[] = [
    { name: 'use', type: KeywordType.REFERENCE, description: 'Import statement', allowMultiple: true },
    { name: 'hdef', type: KeywordType.HEADER_DEFINITION, description: 'Header definition for failure set', required: true },
    { name: 'failureset', type: KeywordType.HEADER_DEFINITION, description: 'Failure set identifier' },
    { name: 'name', type: KeywordType.PROPERTY, description: 'Name property' },
    { name: 'description', type: KeywordType.PROPERTY, description: 'Description property' },
    { name: 'owner', type: KeywordType.PROPERTY, description: 'Owner property' },
    { name: 'tags', type: KeywordType.PROPERTY, description: 'Tags property', allowMultiple: true },
    { name: 'safetylevel', type: KeywordType.ENUM, description: 'Safety level enum' },
    { name: 'level', type: KeywordType.ENUM, description: 'FMEA hierarchy level (system/subsystem/module/part)' },
    { name: 'propagateto', type: KeywordType.RELATION, description: 'Propagate failure to upper level FMEA', allowMultiple: true },
    { name: 'occursin', type: KeywordType.RELATION, description: 'Occurs in block relation for failure analysis', allowMultiple: true },
    { name: 'def', type: KeywordType.DEFINITION, description: 'Definition keyword', allowMultiple: true },
    { name: 'failuremode', type: KeywordType.DEFINITION, description: 'Failure mode definition' },
    // { name: 'cause', type: KeywordType.DEFINITION, description: 'Failure cause definition (hierarchical syntax)' },
    // { name: 'effect', type: KeywordType.DEFINITION, description: 'Failure effect definition (hierarchical syntax)' },
    { name: 'failurerate', type: KeywordType.PROPERTY, description: 'Failure rate (float, FIT)' },
    { name: 'severity', type: KeywordType.PROPERTY, description: 'Severity rating (1-10)' },
    { name: 'detectability', type: KeywordType.PROPERTY, description: 'Detectability rating (1-10)' },
    { name: 'occurrence', type: KeywordType.PROPERTY, description: 'Occurrence rating (1-10)' },
    { name: 'actionpriority', type: KeywordType.ENUM, description: 'Action priority enum (high, medium, low)' },
    { name: 'timingreference', type: KeywordType.ENUM, description: 'Timing reference unit (s, ms, us, ns)' },
    { name: 'allocatedto', type: KeywordType.RELATION, description: 'Allocated to block/component', allowMultiple: true },
    { name: 'affects', type: KeywordType.RELATION, description: 'Affects function/component', allowMultiple: true },
    { name: 'probability', type: KeywordType.PROPERTY, description: 'Probability assessment' },
    { name: 'rpn', type: KeywordType.PROPERTY, description: 'Risk Priority Number (calculated number)' },
    // Temporal properties (unitless - uses hdef timingreference)
    { name: 'faultdetectiontime', type: KeywordType.PROPERTY, description: 'Fault detection time (unitless, uses hdef timingreference)' },
    { name: 'faulttolerancetime', type: KeywordType.PROPERTY, description: 'Fault tolerance time (unitless, uses hdef timingreference)' },
    { name: 'propagationdelay', type: KeywordType.PROPERTY, description: 'Failure propagation delay (unitless, uses hdef timingreference)' },
    { name: 'recoverytime', type: KeywordType.PROPERTY, description: 'Recovery time (unitless, uses hdef timingreference)' },
    // Relationship keywords (new syntax)
    { name: 'causedby', type: KeywordType.RELATION, description: 'Caused by relationship - can only ref failuremode', allowMultiple: true },
    { name: 'effects', type: KeywordType.RELATION, description: 'Effects relationship - can only ref failuremode', allowMultiple: true },
    { name: 'detectedby', type: KeywordType.RELATION, description: 'Detected by - can only ref function', allowMultiple: true },
    { name: 'mitigatedby', type: KeywordType.RELATION, description: 'Mitigated by - can only ref function', allowMultiple: true },
    { name: 'testedby', type: KeywordType.RELATION, description: 'Tested by - can only ref testcase', allowMultiple: true },
    { name: 'derivedfrom', type: KeywordType.RELATION, description: 'Derived from - can only ref requirement', allowMultiple: true },
    { name: 'definedby', type: KeywordType.RELATION, description: 'Defined by - can only ref requirement', allowMultiple: true },
    { name: 'within', type: KeywordType.TEMPORAL, description: 'Temporal constraint (unitless, uses hdef timingreference) - only allowed with causedby/effects/detectedby/mitigatedby' },
    { name: 'when', type: KeywordType.RELATION, description: 'Configuration condition', allowMultiple: true },
    { name: 'requires', type: KeywordType.RELATION, description: 'Requires relation for parameter references', allowMultiple: true },
    { name: 'meets', type: KeywordType.RELATION, description: 'Meets relation for characteristic or safetygoal references', allowMultiple: true },
    { name: 'characteristic', type: KeywordType.REFERENCE, description: 'Characteristic reference' },
    { name: 'ref', type: KeywordType.REFERENCE, description: 'Reference keyword' },
    { name: 'parameter', type: KeywordType.REFERENCE, description: 'Parameter reference' },
    { name: 'attach', type: KeywordType.PROPERTY, description: 'Attachment file path or URL' },
    // Diagnostic codes (binary or hexadecimal)
    { name: 'errorcode', type: KeywordType.PROPERTY, description: 'Error code (binary or hexadecimal)' },
    { name: 'dtc', type: KeywordType.PROPERTY, description: 'Diagnostic Trouble Code (binary or hexadecimal)' },
    // Effort estimation properties
    { name: 'analysiseffort', type: KeywordType.PROPERTY, description: 'Analysis effort in hours' },
    { name: 'deveffort', type: KeywordType.PROPERTY, description: 'Development effort in hours' },
    { name: 'testeffort', type: KeywordType.PROPERTY, description: 'Test effort in hours' },
    // Hardware metrics (ISO 26262 Part 5)
    { name: 'diagnosticcoverage', type: KeywordType.PROPERTY, description: 'Diagnostic coverage percentage (0-100) for SPFM/LFM computation' }
];

// .itm file keywords (ISO 26262 Item Definition)
const ITM_KEYWORDS: Keyword[] = [
    { name: 'use', type: KeywordType.REFERENCE, description: 'Import statement', allowMultiple: true },
    { name: 'hdef', type: KeywordType.HEADER_DEFINITION, description: 'Header definition for item definition', required: true },
    { name: 'itemdefinition', type: KeywordType.HEADER_DEFINITION, description: 'Item definition identifier' },
    { name: 'name', type: KeywordType.PROPERTY, description: 'Name property' },
    { name: 'description', type: KeywordType.PROPERTY, description: 'Description property' },
    { name: 'owner', type: KeywordType.PROPERTY, description: 'Owner property' },
    { name: 'tags', type: KeywordType.PROPERTY, description: 'Tags property', allowMultiple: true },
    { name: 'level', type: KeywordType.ENUM, description: 'Hierarchical level enum (system, subsystem, module, part)' },
    { name: 'iso26262part', type: KeywordType.PROPERTY, description: 'ISO 26262 part reference' },
    { name: 'safetylevel', type: KeywordType.ENUM, description: 'Safety level enum' },
    { name: 'conditions', type: KeywordType.PROPERTY, description: 'Operating conditions' },
    { name: 'def', type: KeywordType.DEFINITION, description: 'Definition keyword', allowMultiple: true },
    { name: 'boundary', type: KeywordType.DEFINITION, description: 'Item boundary definition' },
    { name: 'operatingmode', type: KeywordType.DEFINITION, description: 'Operating mode definition' },
    { name: 'includes', type: KeywordType.RELATION, description: 'Boundary includes relationship', allowMultiple: true },
    { name: 'excludes', type: KeywordType.RELATION, description: 'Boundary excludes relationship', allowMultiple: true },
    { name: 'itemscope', type: KeywordType.RELATION, description: 'Item scope relationship', allowMultiple: true },
    { name: 'when', type: KeywordType.RELATION, description: 'Configuration condition', allowMultiple: true },
    { name: 'requires', type: KeywordType.RELATION, description: 'Requires relation for parameter/datatype references', allowMultiple: true },
    { name: 'ref', type: KeywordType.REFERENCE, description: 'Reference keyword' },
    { name: 'function', type: KeywordType.REFERENCE, description: 'Function reference' },
    { name: 'block', type: KeywordType.REFERENCE, description: 'Block reference' },
    { name: 'parameter', type: KeywordType.REFERENCE, description: 'Parameter reference' },
    // Effort estimation properties
    { name: 'analysiseffort', type: KeywordType.PROPERTY, description: 'Analysis effort in hours' },
    { name: 'deveffort', type: KeywordType.PROPERTY, description: 'Development effort in hours' },
    { name: 'testeffort', type: KeywordType.PROPERTY, description: 'Test effort in hours' }
];

// .haz file keywords (ISO 26262 Hazard Analysis)
const HAZ_KEYWORDS: Keyword[] = [
    { name: 'use', type: KeywordType.REFERENCE, description: 'Import statement', allowMultiple: true },
    { name: 'hdef', type: KeywordType.HEADER_DEFINITION, description: 'Header definition for hazard analysis', required: true },
    { name: 'hazardanalysis', type: KeywordType.HEADER_DEFINITION, description: 'Hazard analysis identifier' },
    { name: 'name', type: KeywordType.PROPERTY, description: 'Name property' },
    { name: 'description', type: KeywordType.PROPERTY, description: 'Description property' },
    { name: 'owner', type: KeywordType.PROPERTY, description: 'Owner property' },
    { name: 'tags', type: KeywordType.PROPERTY, description: 'Tags property', allowMultiple: true },
    { name: 'level', type: KeywordType.ENUM, description: 'Hierarchical level enum (system, subsystem, module, part)' },
    { name: 'iso26262part', type: KeywordType.PROPERTY, description: 'ISO 26262 part reference' },
    { name: 'assessmentdate', type: KeywordType.PROPERTY, description: 'Assessment date' },
    { name: 'hazardclass', type: KeywordType.PROPERTY, description: 'Hazard classification' },
    { name: 'severity', type: KeywordType.ENUM, description: 'Severity rating (S0-S3)' },
    { name: 'exposure', type: KeywordType.ENUM, description: 'Exposure rating (E0-E5)' },
    { name: 'controllability', type: KeywordType.ENUM, description: 'Controllability rating (C0-C3)' },
    { name: 'safetylevel', type: KeywordType.ENUM, description: 'Safety level enum (QM, ASIL-A to ASIL-D)' },
    { name: 'speed', type: KeywordType.PROPERTY, description: 'Speed range' },
    { name: 'environment', type: KeywordType.PROPERTY, description: 'Environmental conditions' },
    { name: 'trafficdensity', type: KeywordType.PROPERTY, description: 'Traffic density' },
    { name: 'maxacceptabledelay', type: KeywordType.PROPERTY, description: 'Maximum acceptable delay' },
    { name: 'nominalresponsetime', type: KeywordType.PROPERTY, description: 'Nominal response time' },
    { name: 'def', type: KeywordType.DEFINITION, description: 'Definition keyword', allowMultiple: true },
    { name: 'hazard', type: KeywordType.DEFINITION, description: 'Hazard definition' },
    { name: 'situation', type: KeywordType.DEFINITION, description: 'Operational situation definition' },
    { name: 'malfunctionof', type: KeywordType.RELATION, description: 'Malfunction of function relationship', allowMultiple: true },
    { name: 'affects', type: KeywordType.RELATION, description: 'Affects feature relationship', allowMultiple: true },
    { name: 'leadsto', type: KeywordType.RELATION, description: 'Leads to safety goal relationship', allowMultiple: true },
    { name: 'when', type: KeywordType.RELATION, description: 'Configuration condition', allowMultiple: true },
    { name: 'requires', type: KeywordType.RELATION, description: 'Requires relation for parameter/datatype references', allowMultiple: true },
    { name: 'ref', type: KeywordType.REFERENCE, description: 'Reference keyword' },
    { name: 'parameter', type: KeywordType.REFERENCE, description: 'Parameter reference' },
    // Effort estimation properties
    { name: 'analysiseffort', type: KeywordType.PROPERTY, description: 'Analysis effort in hours' },
    { name: 'deveffort', type: KeywordType.PROPERTY, description: 'Development effort in hours' },
    { name: 'testeffort', type: KeywordType.PROPERTY, description: 'Test effort in hours' }
];

// .sgl file keywords (ISO 26262 Safety Goals)
const SGL_KEYWORDS: Keyword[] = [
    { name: 'use', type: KeywordType.REFERENCE, description: 'Import statement', allowMultiple: true },
    { name: 'hdef', type: KeywordType.HEADER_DEFINITION, description: 'Header definition for safety goals', required: true },
    { name: 'safetygoalset', type: KeywordType.HEADER_DEFINITION, description: 'Safety goal set identifier' },
    { name: 'name', type: KeywordType.PROPERTY, description: 'Name property' },
    { name: 'description', type: KeywordType.PROPERTY, description: 'Description property' },
    { name: 'owner', type: KeywordType.PROPERTY, description: 'Owner property' },
    { name: 'tags', type: KeywordType.PROPERTY, description: 'Tags property', allowMultiple: true },
    { name: 'level', type: KeywordType.ENUM, description: 'Hierarchical level enum (system, subsystem, module, part)' },
    { name: 'safetylevel', type: KeywordType.ENUM, description: 'Safety level enum (ASIL-A to ASIL-D, QM)' },
    { name: 'def', type: KeywordType.DEFINITION, description: 'Definition keyword', allowMultiple: true },
    { name: 'safetygoal', type: KeywordType.DEFINITION, description: 'Safety goal definition' },
    { name: 'derivedfrom', type: KeywordType.RELATION, description: 'Derived from hazard/situation relationship', allowMultiple: true },
    { name: 'mitigates', type: KeywordType.RELATION, description: 'Mitigates hazard relationship', allowMultiple: true },
    { name: 'safestate', type: KeywordType.PROPERTY, description: 'Safe state description' },
    { name: 'safecondition', type: KeywordType.PROPERTY, description: 'Safe state condition definition' },
    { name: 'faulttoleranttime', type: KeywordType.PROPERTY, description: 'Fault tolerant time interval (FTTI) in milliseconds' },
    { name: 'emergencyoperationtime', type: KeywordType.PROPERTY, description: 'Emergency operation time in milliseconds' },
    { name: 'leadsto', type: KeywordType.RELATION, description: 'Leads to requirement relationship', allowMultiple: true },
    { name: 'allocatedto', type: KeywordType.RELATION, description: 'Allocated to item relationship', allowMultiple: true },
    { name: 'when', type: KeywordType.RELATION, description: 'Configuration condition', allowMultiple: true },
    { name: 'requires', type: KeywordType.RELATION, description: 'Requires relation for parameter/datatype references', allowMultiple: true },
    { name: 'ref', type: KeywordType.REFERENCE, description: 'Reference keyword' },
    { name: 'hazard', type: KeywordType.REFERENCE, description: 'Hazard reference' },
    { name: 'situation', type: KeywordType.REFERENCE, description: 'Situation reference' },
    { name: 'item', type: KeywordType.REFERENCE, description: 'Item reference' },
    { name: 'requirement', type: KeywordType.REFERENCE, description: 'Requirement reference' },
    { name: 'parameter', type: KeywordType.REFERENCE, description: 'Parameter reference' },
    // Effort estimation properties
    { name: 'analysiseffort', type: KeywordType.PROPERTY, description: 'Analysis effort in hours' },
    { name: 'deveffort', type: KeywordType.PROPERTY, description: 'Development effort in hours' },
    { name: 'testeffort', type: KeywordType.PROPERTY, description: 'Test effort in hours' }
];

// .sam file keywords (ISO 26262 Safety Mechanisms)
const SAM_KEYWORDS: Keyword[] = [
    { name: 'use', type: KeywordType.REFERENCE, description: 'Import statement', allowMultiple: true },
    { name: 'hdef', type: KeywordType.HEADER_DEFINITION, description: 'Header definition for safety mechanisms', required: true },
    { name: 'safetymechanismset', type: KeywordType.HEADER_DEFINITION, description: 'Safety mechanism set identifier' },
    { name: 'name', type: KeywordType.PROPERTY, description: 'Name property' },
    { name: 'description', type: KeywordType.PROPERTY, description: 'Description property' },
    { name: 'owner', type: KeywordType.PROPERTY, description: 'Owner property' },
    { name: 'tags', type: KeywordType.PROPERTY, description: 'Tags property', allowMultiple: true },
    { name: 'level', type: KeywordType.ENUM, description: 'Hierarchical level enum (system, subsystem, module, part)' },
    { name: 'iso26262part', type: KeywordType.PROPERTY, description: 'ISO 26262 part reference' },
    { name: 'safetylevel', type: KeywordType.ENUM, description: 'Safety level enum' },
    { name: 'mechanismtype', type: KeywordType.ENUM, description: 'Safety mechanism type enum' },
    { name: 'safetymechanismeffectiveness', type: KeywordType.PROPERTY, description: 'Safety mechanism effectiveness percentage' },
    { name: 'detectiontime', type: KeywordType.PROPERTY, description: 'Detection time' },
    { name: 'reactiontime', type: KeywordType.PROPERTY, description: 'Reaction time' },
    { name: 'def', type: KeywordType.DEFINITION, description: 'Definition keyword', allowMultiple: true },
    { name: 'safetymechanism', type: KeywordType.DEFINITION, description: 'Safety mechanism definition' },
    { name: 'satisfies', type: KeywordType.RELATION, description: 'Satisfies requirement relationship', allowMultiple: true },
    { name: 'mitigates', type: KeywordType.RELATION, description: 'Mitigates hazard relationship', allowMultiple: true },
    { name: 'allocatedto', type: KeywordType.RELATION, description: 'Allocated to block relationship', allowMultiple: true },
    { name: 'implementedby', type: KeywordType.RELATION, description: 'Implemented by function relationship', allowMultiple: true },
    { name: 'detects', type: KeywordType.RELATION, description: 'Detects failure mode relationship', allowMultiple: true },
    { name: 'verifiedby', type: KeywordType.RELATION, description: 'Verified by test case relationship', allowMultiple: true },
    { name: 'when', type: KeywordType.RELATION, description: 'Configuration condition', allowMultiple: true },
    { name: 'requires', type: KeywordType.RELATION, description: 'Requires relation for parameter/datatype references', allowMultiple: true },
    { name: 'ref', type: KeywordType.REFERENCE, description: 'Reference keyword' },
    { name: 'function', type: KeywordType.REFERENCE, description: 'Function reference' },
    { name: 'block', type: KeywordType.REFERENCE, description: 'Block reference' },
    { name: 'failuremode', type: KeywordType.REFERENCE, description: 'Failure mode reference' },
    { name: 'requirement', type: KeywordType.REFERENCE, description: 'Requirement reference' },
    { name: 'hazard', type: KeywordType.REFERENCE, description: 'Hazard reference' },
    { name: 'testcase', type: KeywordType.REFERENCE, description: 'Test case reference' },
    { name: 'parameter', type: KeywordType.REFERENCE, description: 'Parameter reference' },
    // Effort estimation properties
    { name: 'analysiseffort', type: KeywordType.PROPERTY, description: 'Analysis effort in hours' },
    { name: 'deveffort', type: KeywordType.PROPERTY, description: 'Development effort in hours' },
    { name: 'testeffort', type: KeywordType.PROPERTY, description: 'Test effort in hours' }
];

// .fta file keywords (Fault Tree Analysis)
const FTA_KEYWORDS: Keyword[] = [
    { name: 'use', type: KeywordType.REFERENCE, description: 'Import statement', allowMultiple: true },
    { name: 'hdef', type: KeywordType.HEADER_DEFINITION, description: 'Header definition for fault tree', required: true },
    { name: 'faulttree', type: KeywordType.HEADER_DEFINITION, description: 'Fault tree identifier' },
    { name: 'name', type: KeywordType.PROPERTY, description: 'Name property' },
    { name: 'description', type: KeywordType.PROPERTY, description: 'Description property' },
    { name: 'owner', type: KeywordType.PROPERTY, description: 'Owner property' },
    { name: 'tags', type: KeywordType.PROPERTY, description: 'Tags property', allowMultiple: true },
    { name: 'level', type: KeywordType.ENUM, description: 'Hierarchical level enum' },
    { name: 'safetylevel', type: KeywordType.ENUM, description: 'Safety level enum' },
    { name: 'topevent', type: KeywordType.RELATION, description: 'Top event reference to failuremode', allowMultiple: true },
    { name: 'def', type: KeywordType.DEFINITION, description: 'Definition keyword', allowMultiple: true },
    { name: 'gate', type: KeywordType.DEFINITION, description: 'Logic gate definition' },
    { name: 'gatetype', type: KeywordType.ENUM, description: 'Gate type enum' },
    { name: 'input', type: KeywordType.RELATION, description: 'Gate input reference', allowMultiple: true },
    { name: 'output', type: KeywordType.RELATION, description: 'Gate output reference', allowMultiple: true },
    { name: 'allocatedto', type: KeywordType.RELATION, description: 'Allocated to block reference', allowMultiple: true },
    { name: 'requires', type: KeywordType.RELATION, description: 'Requires relation for parameter/datatype references', allowMultiple: true },
    { name: 'ref', type: KeywordType.REFERENCE, description: 'Reference keyword' },
    { name: 'parameter', type: KeywordType.REFERENCE, description: 'Parameter reference' },
    { name: 'when', type: KeywordType.RELATION, description: 'Configuration condition', allowMultiple: true },
    // Effort estimation properties
    { name: 'analysiseffort', type: KeywordType.PROPERTY, description: 'Analysis effort in hours' },
    { name: 'deveffort', type: KeywordType.PROPERTY, description: 'Development effort in hours' },
    { name: 'testeffort', type: KeywordType.PROPERTY, description: 'Test effort in hours' }
];

// .smd file keywords (State Machine Diagram)
const SMD_KEYWORDS: Keyword[] = [
    { name: 'use', type: KeywordType.REFERENCE, description: 'Import statement', allowMultiple: true },
    { name: 'hdef', type: KeywordType.HEADER_DEFINITION, description: 'Header definition for state machine', required: true },
    { name: 'statemachine', type: KeywordType.HEADER_DEFINITION, description: 'State machine identifier' },
    { name: 'name', type: KeywordType.PROPERTY, description: 'Name property' },
    { name: 'description', type: KeywordType.PROPERTY, description: 'Description property' },
    { name: 'owner', type: KeywordType.PROPERTY, description: 'Owner property' },
    { name: 'tags', type: KeywordType.PROPERTY, description: 'Tags property', allowMultiple: true },
    { name: 'level', type: KeywordType.ENUM, description: 'Hierarchical level enum' },
    { name: 'safetylevel', type: KeywordType.ENUM, description: 'Safety level enum' },
    { name: 'status', type: KeywordType.ENUM, description: 'Status enum' },
    { name: 'allocatedto', type: KeywordType.RELATION, description: 'Allocated to block reference', allowMultiple: true },
    { name: 'implements', type: KeywordType.RELATION, description: 'Implements requirement reference', allowMultiple: true },
    { name: 'def', type: KeywordType.DEFINITION, description: 'Definition keyword', allowMultiple: true },
    { name: 'state', type: KeywordType.DEFINITION, description: 'State definition' },
    { name: 'transition', type: KeywordType.DEFINITION, description: 'Transition definition' },
    { name: 'initialstate', type: KeywordType.OPTIONAL_FLAG, description: 'Initial state flag' },
    { name: 'endstate', type: KeywordType.OPTIONAL_FLAG, description: 'End state flag' },
    { name: 'from', type: KeywordType.RELATION, description: 'Source state relation', allowMultiple: true },
    { name: 'to', type: KeywordType.RELATION, description: 'Target state relation', allowMultiple: true },
    { name: 'condition', type: KeywordType.PROPERTY, description: 'Transition condition' },
    { name: 'call', type: KeywordType.RELATION, description: 'Call function reference', allowMultiple: true },
    { name: 'requires', type: KeywordType.RELATION, description: 'Requires relation for parameter/datatype references', allowMultiple: true },
    { name: 'ref', type: KeywordType.REFERENCE, description: 'Reference keyword' },
    { name: 'parameter', type: KeywordType.REFERENCE, description: 'Parameter reference' },
    { name: 'when', type: KeywordType.RELATION, description: 'Configuration condition', allowMultiple: true },
    { name: 'function', type: KeywordType.REFERENCE, description: 'Function reference' },
    { name: 'block', type: KeywordType.REFERENCE, description: 'Block reference' },
    { name: 'requirement', type: KeywordType.REFERENCE, description: 'Requirement reference' },
    { name: 'config', type: KeywordType.CONFIG, description: 'Config reference' },
    // Effort estimation properties
    { name: 'analysiseffort', type: KeywordType.PROPERTY, description: 'Analysis effort in hours' },
    { name: 'deveffort', type: KeywordType.PROPERTY, description: 'Development effort in hours' },
    { name: 'testeffort', type: KeywordType.PROPERTY, description: 'Test effort in hours' }
];

// Interface Definition Keywords (.ifc)
const IFC_KEYWORDS: Keyword[] = [
    // Import statement
    { name: 'use', type: KeywordType.REFERENCE, description: 'Import statement', allowMultiple: true },
    // Header definition
    { name: 'hdef', type: KeywordType.HEADER_DEFINITION, description: 'Header definition keyword', required: true },
    { name: 'interfaceset', type: KeywordType.HEADER_DEFINITION, description: 'Interface set header definition', required: true },

    // Common properties
    { name: 'name', type: KeywordType.PROPERTY, description: 'Name property', required: true },
    { name: 'description', type: KeywordType.PROPERTY, description: 'Description property' },
    { name: 'owner', type: KeywordType.PROPERTY, description: 'Owner property' },
    { name: 'tags', type: KeywordType.PROPERTY, description: 'Tags property', allowMultiple: true },
    { name: 'value', type: KeywordType.PROPERTY, description: 'Value property for parameters (numeric: integer or float)' },
    { name: 'unit', type: KeywordType.PROPERTY, description: 'Unit of measurement for parameters (string)' },
    { name: 'safetylevel', type: KeywordType.ENUM, description: 'Safety level enum' },
    { name: 'level', type: KeywordType.ENUM, description: 'Level enum' },

    // Definition types
    { name: 'def', type: KeywordType.DEFINITION, description: 'Definition keyword', allowMultiple: true },
    { name: 'operation', type: KeywordType.DEFINITION, description: 'Operation definition' },
    { name: 'signal', type: KeywordType.DEFINITION, description: 'Signal definition' },
    { name: 'datatype', type: KeywordType.DEFINITION, description: 'Data type definition' },
    { name: 'parameter', type: KeywordType.DEFINITION, description: 'Parameter definition' },

    // Relationships
    { name: 'decomposedfrom', type: KeywordType.RELATION, description: 'Decomposes from interfaceset relation', allowMultiple: true },
    { name: 'decomposesto', type: KeywordType.RELATION, description: 'Decomposes to interfaceset relation', allowMultiple: true },
    { name: 'allocatedto', type: KeywordType.RELATION, description: 'Allocated to block relation', allowMultiple: true },
    { name: 'derivedfrom', type: KeywordType.RELATION, description: 'Derived from requirement relation (ASPICE bilateral traceability)', allowMultiple: true },
    { name: 'implementedby', type: KeywordType.RELATION, description: 'Implemented by requirement relation (ASPICE bilateral traceability)', allowMultiple: true },
    { name: 'when', type: KeywordType.RELATION, description: 'When relation for conditional config references', allowMultiple: true },
    { name: 'requires', type: KeywordType.RELATION, description: 'Requires relation for datatype/parameter references', allowMultiple: true },
    { name: 'meets', type: KeywordType.RELATION, description: 'Meets relation for characteristic or safetygoal references', allowMultiple: true },
    { name: 'ref', type: KeywordType.REFERENCE, description: 'Reference keyword' },
    { name: 'config', type: KeywordType.CONFIG, description: 'Config reference' },
    { name: 'interfaceset', type: KeywordType.REFERENCE, description: 'Interface set reference' },
    { name: 'block', type: KeywordType.REFERENCE, description: 'Block reference' },
    { name: 'requirement', type: KeywordType.REFERENCE, description: 'Requirement reference' },
    { name: 'datatype', type: KeywordType.REFERENCE, description: 'Data type reference' },
    { name: 'characteristic', type: KeywordType.REFERENCE, description: 'Characteristic reference' },
    { name: 'attach', type: KeywordType.PROPERTY, description: 'Attachment file path or URL' },
    // Effort estimation properties
    { name: 'analysiseffort', type: KeywordType.PROPERTY, description: 'Analysis effort in hours' },
    { name: 'deveffort', type: KeywordType.PROPERTY, description: 'Development effort in hours' },
    { name: 'testeffort', type: KeywordType.PROPERTY, description: 'Test effort in hours' }
];

// .spec file keywords (Specification Documents)
const SPEC_KEYWORDS: Keyword[] = [
    // Import statement
    { name: 'use', type: KeywordType.REFERENCE, description: 'Import statement', allowMultiple: true },

    // Header definition
    { name: 'hdef', type: KeywordType.HEADER_DEFINITION, description: 'Header definition keyword', required: true },
    { name: 'specification', type: KeywordType.HEADER_DEFINITION, description: 'Specification header definition', required: true },

    // Common properties
    { name: 'name', type: KeywordType.PROPERTY, description: 'Name property', required: true },
    { name: 'description', type: KeywordType.PROPERTY, description: 'Description property' },
    { name: 'owner', type: KeywordType.PROPERTY, description: 'Owner property' },
    { name: 'version', type: KeywordType.PROPERTY, description: 'Version property' },

    // Section and content definitions
    { name: 'def', type: KeywordType.DEFINITION, description: 'Definition keyword', allowMultiple: true },
    { name: 'section', type: KeywordType.DEFINITION, description: 'Section definition' },
    { name: 'spec', type: KeywordType.DEFINITION, description: 'Specification content definition' },
    { name: 'diagram', type: KeywordType.DEFINITION, description: 'Diagram content definition' },
    { name: 'table', type: KeywordType.DEFINITION, description: 'Table content definition' },

    // Source reference and query keywords
    { name: 'source', type: KeywordType.RELATION, description: 'Source reference for data (supports globs: "*.req", "**/*.req", multiple: "file1.req", "file2.req")', allowMultiple: true },
    { name: 'where', type: KeywordType.RELATION, description: 'Filter condition', allowMultiple: true },
    { name: 'groupby', type: KeywordType.RELATION, description: 'Group by property', allowMultiple: true },
    { name: 'orderby', type: KeywordType.RELATION, description: 'Order by property', allowMultiple: true },
    { name: 'columns', type: KeywordType.PROPERTY, description: 'Table columns', allowMultiple: true },

    // Node type references
    { name: 'requirementset', type: KeywordType.REFERENCE, description: 'Requirement set reference' },
    { name: 'usecaseset', type: KeywordType.REFERENCE, description: 'Use case set reference' },
    { name: 'sequenceset', type: KeywordType.REFERENCE, description: 'Sequence set reference' },
    { name: 'functionset', type: KeywordType.REFERENCE, description: 'Function set reference' },
    { name: 'blockset', type: KeywordType.REFERENCE, description: 'Block set reference' },
    { name: 'featureset', type: KeywordType.REFERENCE, description: 'Feature set reference' },
    { name: 'testcaseset', type: KeywordType.REFERENCE, description: 'Test case set reference' },
    { name: 'failuremodeset', type: KeywordType.REFERENCE, description: 'Failure mode set reference' },
    { name: 'faulttreeset', type: KeywordType.REFERENCE, description: 'Fault tree set reference' },
    { name: 'hazardset', type: KeywordType.REFERENCE, description: 'Hazard set reference' },
    { name: 'agentset', type: KeywordType.REFERENCE, description: 'Agent set reference' },
    { name: 'sprintset', type: KeywordType.REFERENCE, description: 'Sprint set reference' },
    { name: 'statemachineset', type: KeywordType.REFERENCE, description: 'State machine set reference' },
    { name: 'variantset', type: KeywordType.REFERENCE, description: 'Variant set reference' },
    { name: 'configset', type: KeywordType.REFERENCE, description: 'Config set reference' },
    { name: 'interfaceset', type: KeywordType.REFERENCE, description: 'Interface set reference' }
];

// .dash file keywords (Dashboard)
const DASH_KEYWORDS: Keyword[] = [
    // Import statement
    { name: 'use', type: KeywordType.REFERENCE, description: 'Import statement', allowMultiple: true },

    // Header definition
    { name: 'hdef', type: KeywordType.HEADER_DEFINITION, description: 'Header definition keyword', required: true },
    { name: 'dashboard', type: KeywordType.HEADER_DEFINITION, description: 'Dashboard header definition', required: true },

    // Common properties
    { name: 'name', type: KeywordType.PROPERTY, description: 'Name property', required: true },
    { name: 'description', type: KeywordType.PROPERTY, description: 'Description property' },
    { name: 'owner', type: KeywordType.PROPERTY, description: 'Owner property' },
    { name: 'version', type: KeywordType.PROPERTY, description: 'Version property' },

    // Dashboard-specific properties
    { name: 'grid', type: KeywordType.PROPERTY, description: 'Grid layout definition (e.g., 3x4)', required: true },

    // Widget definitions
    { name: 'def', type: KeywordType.DEFINITION, description: 'Definition keyword', allowMultiple: true },
    { name: 'metric', type: KeywordType.DEFINITION, description: 'Metric widget definition' },
    { name: 'chart', type: KeywordType.DEFINITION, description: 'Chart widget definition' },
    { name: 'table', type: KeywordType.DEFINITION, description: 'Table widget definition' },

    // Widget properties
    { name: 'type', type: KeywordType.ENUM, description: 'Widget type (metric type or chart type)' },
    { name: 'property', type: KeywordType.PROPERTY, description: 'Property for aggregation (avg, sum, etc.)' },
    { name: 'xaxis', type: KeywordType.PROPERTY, description: 'X-axis label for charts' },
    { name: 'yaxis', type: KeywordType.PROPERTY, description: 'Y-axis label for charts' },
    { name: 'span', type: KeywordType.PROPERTY, description: 'Widget span (e.g., 1x2)' },

    // Query keywords (RENAMED v2.32.0)
    { name: 'sourcetype', type: KeywordType.REFERENCE, description: 'Node type for query (requirement, function, etc.)' },
    { name: 'source', type: KeywordType.RELATION, description: 'File patterns for scope (supports globs: "*.req", "**/*.req", multiple: "file1.req", "file2.req")', allowMultiple: true },
    { name: 'where', type: KeywordType.RELATION, description: 'Filter condition', allowMultiple: true },
    { name: 'groupby', type: KeywordType.RELATION, description: 'Group by property', allowMultiple: true },
    { name: 'orderby', type: KeywordType.RELATION, description: 'Order by property', allowMultiple: true },
    { name: 'columns', type: KeywordType.PROPERTY, description: 'Table columns', allowMultiple: true },

    // Node type references (same as spec)
    { name: 'requirementset', type: KeywordType.REFERENCE, description: 'Requirement set reference' },
    { name: 'usecaseset', type: KeywordType.REFERENCE, description: 'Use case set reference' },
    { name: 'sequenceset', type: KeywordType.REFERENCE, description: 'Sequence set reference' },
    { name: 'functionset', type: KeywordType.REFERENCE, description: 'Function set reference' },
    { name: 'blockset', type: KeywordType.REFERENCE, description: 'Block set reference' },
    { name: 'featureset', type: KeywordType.REFERENCE, description: 'Feature set reference' },
    { name: 'testcaseset', type: KeywordType.REFERENCE, description: 'Test case set reference' },
    { name: 'failuremodeset', type: KeywordType.REFERENCE, description: 'Failure mode set reference' },
    { name: 'faulttreeset', type: KeywordType.REFERENCE, description: 'Fault tree set reference' },
    { name: 'hazardset', type: KeywordType.REFERENCE, description: 'Hazard set reference' },
    { name: 'agentset', type: KeywordType.REFERENCE, description: 'Agent set reference' },
    { name: 'sprintset', type: KeywordType.REFERENCE, description: 'Sprint set reference' },
    { name: 'statemachineset', type: KeywordType.REFERENCE, description: 'State machine set reference' },
    { name: 'variantset', type: KeywordType.REFERENCE, description: 'Variant set reference' },
    { name: 'configset', type: KeywordType.REFERENCE, description: 'Config set reference' },
    { name: 'interfaceset', type: KeywordType.REFERENCE, description: 'Interface set reference' }
];

// .asm file keywords (Assembly)
const ASM_KEYWORDS: Keyword[] = [
    { name: 'use', type: KeywordType.REFERENCE, description: 'Import statement', allowMultiple: true },
    { name: 'hdef', type: KeywordType.HEADER_DEFINITION, description: 'Header definition for assembly', required: true },
    { name: 'assembly', type: KeywordType.HEADER_DEFINITION, description: 'Assembly identifier' },
    { name: 'name', type: KeywordType.PROPERTY, description: 'Name property' },
    { name: 'description', type: KeywordType.PROPERTY, description: 'Description property' },
    { name: 'owner', type: KeywordType.PROPERTY, description: 'Owner property' },
    { name: 'tags', type: KeywordType.PROPERTY, description: 'Tags property', allowMultiple: true },
    { name: 'safetylevel', type: KeywordType.ENUM, description: 'Safety level enum' },
    { name: 'modelfile', type: KeywordType.PROPERTY, description: 'Path to assembly CAD model file (.FCStd)' },
    { name: 'mass', type: KeywordType.PROPERTY, description: 'Total assembly mass in kg' },
    { name: 'volume', type: KeywordType.PROPERTY, description: 'Total assembly volume in cm³' },
    { name: 'centerofmass', type: KeywordType.PROPERTY, description: 'Assembly center of mass (x y z)' },
    { name: 'assembles', type: KeywordType.RELATION, description: 'Assembles relation - references parts', allowMultiple: true },
    { name: 'derivedfrom', type: KeywordType.RELATION, description: 'Derived from requirement relation', allowMultiple: true },
    { name: 'implementedby', type: KeywordType.RELATION, description: 'Implemented by requirement relation', allowMultiple: true },
    { name: 'allocatedto', type: KeywordType.RELATION, description: 'Allocated to block relation', allowMultiple: true },
    { name: 'when', type: KeywordType.RELATION, description: 'When relation for conditional config references', allowMultiple: true },
    { name: 'ref', type: KeywordType.REFERENCE, description: 'Reference keyword' },
    { name: 'part', type: KeywordType.REFERENCE, description: 'Part (block) reference' },
    { name: 'block', type: KeywordType.REFERENCE, description: 'Block reference' },
    { name: 'requirement', type: KeywordType.REFERENCE, description: 'Requirement reference' },
    { name: 'config', type: KeywordType.CONFIG, description: 'Config reference' }
];

// .fem file keywords (FEM Analysis)
const FEM_KEYWORDS: Keyword[] = [
    { name: 'use', type: KeywordType.REFERENCE, description: 'Import statement', allowMultiple: true },
    { name: 'hdef', type: KeywordType.HEADER_DEFINITION, description: 'Header definition for FEM analysis', required: true },
    { name: 'femanalysis', type: KeywordType.HEADER_DEFINITION, description: 'FEM analysis identifier' },
    { name: 'name', type: KeywordType.PROPERTY, description: 'Name property' },
    { name: 'description', type: KeywordType.PROPERTY, description: 'Description property' },
    { name: 'owner', type: KeywordType.PROPERTY, description: 'Owner property' },
    { name: 'tags', type: KeywordType.PROPERTY, description: 'Tags property', allowMultiple: true },
    { name: 'safetylevel', type: KeywordType.ENUM, description: 'Safety level enum' },
    { name: 'modelfile', type: KeywordType.PROPERTY, description: 'Path to CAD model file for analysis' },
    { name: 'analysistype', type: KeywordType.PROPERTY, description: 'Analysis type (static_stress, modal, thermal, etc.)' },
    { name: 'solver', type: KeywordType.PROPERTY, description: 'FEM solver (CalculiX, etc.)' },
    { name: 'meshsize', type: KeywordType.PROPERTY, description: 'Mesh element size in mm' },
    { name: 'meshrefinement', type: KeywordType.PROPERTY, description: 'Mesh refinement size for critical areas' },
    { name: 'def', type: KeywordType.DEFINITION, description: 'Definition keyword', allowMultiple: true },
    { name: 'material', type: KeywordType.DEFINITION, description: 'Material definition for FEM' },
    { name: 'load', type: KeywordType.DEFINITION, description: 'Load definition' },
    { name: 'constraint', type: KeywordType.DEFINITION, description: 'Constraint/boundary condition definition' },
    { name: 'validationcriteria', type: KeywordType.DEFINITION, description: 'Validation criteria definition' },
    { name: 'materialname', type: KeywordType.PROPERTY, description: 'Material name' },
    { name: 'density', type: KeywordType.PROPERTY, description: 'Material density in kg/m³' },
    { name: 'youngsmodulus', type: KeywordType.PROPERTY, description: 'Young\'s modulus in GPa' },
    { name: 'poissonratio', type: KeywordType.PROPERTY, description: 'Poisson\'s ratio (0-0.5)' },
    { name: 'yieldstrength', type: KeywordType.PROPERTY, description: 'Yield strength in MPa' },
    { name: 'loadtype', type: KeywordType.PROPERTY, description: 'Load type (force, pressure, torque, etc.)' },
    { name: 'magnitude', type: KeywordType.PROPERTY, description: 'Load magnitude (numeric value)' },
    { name: 'direction', type: KeywordType.PROPERTY, description: 'Load direction vector (x y z)' },
    { name: 'location', type: KeywordType.PROPERTY, description: 'Location description' },
    { name: 'constrainttype', type: KeywordType.PROPERTY, description: 'Constraint type (fixed, symmetry, etc.)' },
    { name: 'maxstress', type: KeywordType.PROPERTY, description: 'Maximum allowable stress in MPa' },
    { name: 'maxdisplacement', type: KeywordType.PROPERTY, description: 'Maximum allowable displacement in mm' },
    { name: 'minsafetyfactor', type: KeywordType.PROPERTY, description: 'Minimum safety factor' },
    { name: 'minfatiguecycles', type: KeywordType.PROPERTY, description: 'Minimum fatigue life cycles' },
    { name: 'analysisof', type: KeywordType.RELATION, description: 'Analysis of relation - references part or assembly', allowMultiple: true },
    { name: 'derivedfrom', type: KeywordType.RELATION, description: 'Derived from requirement relation', allowMultiple: true },
    { name: 'implementedby', type: KeywordType.RELATION, description: 'Implemented by requirement relation', allowMultiple: true },
    { name: 'satisfies', type: KeywordType.RELATION, description: 'Satisfies requirement relation', allowMultiple: true },
    { name: 'when', type: KeywordType.RELATION, description: 'When relation for conditional config references', allowMultiple: true },
    { name: 'ref', type: KeywordType.REFERENCE, description: 'Reference keyword' },
    { name: 'part', type: KeywordType.REFERENCE, description: 'Part (block) reference' },
    { name: 'block', type: KeywordType.REFERENCE, description: 'Block reference' },
    { name: 'assembly', type: KeywordType.REFERENCE, description: 'Assembly reference' },
    { name: 'requirement', type: KeywordType.REFERENCE, description: 'Requirement reference' },
    { name: 'config', type: KeywordType.CONFIG, description: 'Config reference' }
];

// File type definitions - EXTENSIBLE ARRAY as requested
export const SYLANG_FILE_TYPES: FileTypeKeywords[] = [
    {
        fileExtension: '.ple',
        displayName: 'Product Line',
        allowedKeywords: PLE_KEYWORDS,
        requiredKeywords: ['hdef', 'productline'],
        headerKeyword: 'productline'
    },
    {
        fileExtension: '.fml',
        displayName: 'Feature Model',
        allowedKeywords: FML_KEYWORDS,
        requiredKeywords: ['hdef', 'featureset'],
        headerKeyword: 'featureset'
    },
    {
        fileExtension: '.vml',
        displayName: 'Variant Model',
        allowedKeywords: VML_KEYWORDS,
        requiredKeywords: ['hdef', 'variantset'],
        headerKeyword: 'variantset'
    },
    {
        fileExtension: '.vcf',
        displayName: 'Variant Config',
        allowedKeywords: VCF_KEYWORDS,
        requiredKeywords: ['hdef', 'configset'],
        headerKeyword: 'configset'
    },
    {
        fileExtension: '.fun',
        displayName: 'Function Group',
        allowedKeywords: FUN_KEYWORDS,
        requiredKeywords: ['hdef', 'functionset'],
        headerKeyword: 'functionset'
    },
    {
        fileExtension: '.req',
        displayName: 'Requirements',
        allowedKeywords: REQ_KEYWORDS,
        requiredKeywords: ['hdef', 'requirementset'],
        headerKeyword: 'requirementset'
    },
    {
        fileExtension: '.tst',
        displayName: 'Test Suite',
        allowedKeywords: TST_KEYWORDS,
        requiredKeywords: ['hdef', 'testset'],
        headerKeyword: 'testset'
    },
    {
        fileExtension: '.blk',
        displayName: 'Block',
        allowedKeywords: BLK_KEYWORDS,
        requiredKeywords: ['hdef', 'block'],
        headerKeyword: 'block'
    },
    {
        fileExtension: '.spr',
        displayName: 'Sprint',
        allowedKeywords: SPR_KEYWORDS,
        requiredKeywords: ['hdef', 'sprint'],
        headerKeyword: 'sprint'
    },
    {
        fileExtension: '.agt',
        displayName: 'Agent',
        allowedKeywords: AGT_KEYWORDS,
        requiredKeywords: ['hdef', 'agentset'],
        headerKeyword: 'agentset'
    },
    {
        fileExtension: '.ucd',
        displayName: 'Use Case Diagram',
        allowedKeywords: UCD_KEYWORDS,
        requiredKeywords: ['hdef', 'usecaseset'],
        headerKeyword: 'usecaseset'
    },
    {
        fileExtension: '.seq',
        displayName: 'Sequence Diagram',
        allowedKeywords: SEQ_KEYWORDS,
        requiredKeywords: ['hdef', 'sequenceset'],
        headerKeyword: 'sequenceset'
    },
    {
        fileExtension: '.flr',
        displayName: 'Failure Analysis',
        allowedKeywords: FLR_KEYWORDS,
        requiredKeywords: ['hdef', 'failureset'],
        headerKeyword: 'failureset'
    },
    {
        fileExtension: '.itm',
        displayName: 'Item Definition (ISO 26262)',
        allowedKeywords: ITM_KEYWORDS,
        requiredKeywords: ['hdef', 'itemdefinition'],
        headerKeyword: 'itemdefinition'
    },
    {
        fileExtension: '.haz',
        displayName: 'Hazard Analysis (ISO 26262)',
        allowedKeywords: HAZ_KEYWORDS,
        requiredKeywords: ['hdef', 'hazardanalysis'],
        headerKeyword: 'hazardanalysis'
    },
    {
        fileExtension: '.sgl',
        displayName: 'Safety Goals (ISO 26262)',
        allowedKeywords: SGL_KEYWORDS,
        requiredKeywords: ['hdef', 'safetygoalset'],
        headerKeyword: 'safetygoalset'
    },
    {
        fileExtension: '.sam',
        displayName: 'Safety Mechanisms (ISO 26262)',
        allowedKeywords: SAM_KEYWORDS,
        requiredKeywords: ['hdef', 'safetymechanismset'],
        headerKeyword: 'safetymechanismset'
    },
    {
        fileExtension: '.fta',
        displayName: 'Fault Tree Analysis',
        allowedKeywords: FTA_KEYWORDS,
        requiredKeywords: ['hdef', 'faulttree'],
        headerKeyword: 'faulttree'
    },
    {
        fileExtension: '.smd',
        displayName: 'State Machine Diagram',
        allowedKeywords: SMD_KEYWORDS,
        requiredKeywords: ['hdef', 'statemachine'],
        headerKeyword: 'statemachine'
    },
    {
        fileExtension: '.ifc',
        displayName: 'Interface Definition',
        allowedKeywords: IFC_KEYWORDS,
        requiredKeywords: ['hdef', 'interfaceset'],
        headerKeyword: 'interfaceset'
    },
    {
        fileExtension: '.spec',
        displayName: 'Specification Document',
        allowedKeywords: SPEC_KEYWORDS,
        requiredKeywords: ['hdef', 'specification'],
        headerKeyword: 'specification'
    },
    {
        fileExtension: '.dash',
        displayName: 'Dashboard',
        allowedKeywords: DASH_KEYWORDS,
        requiredKeywords: ['hdef', 'dashboard', 'grid'],
        headerKeyword: 'dashboard'
    },
    // Assembly Definition (.asm) - NEW: Replaces .cad
    {
        fileExtension: '.asm',
        displayName: 'Assembly',
        allowedKeywords: ASM_KEYWORDS,
        requiredKeywords: ['hdef', 'assembly'],
        headerKeyword: 'assembly'
    },
    // FEM Analysis Definition (.fem)
    {
        fileExtension: '.fem',
        displayName: 'FEM Analysis',
        allowedKeywords: FEM_KEYWORDS,
        requiredKeywords: ['hdef', 'femanalysis'],
        headerKeyword: 'femanalysis'
    }
];



// Utility functions for keyword management  
export class SylangKeywordManager {

    static getFileTypeKeywords(fileExtension: string): FileTypeKeywords | undefined {
        return SYLANG_FILE_TYPES.find(ft => ft.fileExtension === fileExtension);
    }

    /**
     * Get keywords for file type with optional extension support (NON-BREAKING)
     */
    static getKeywordsForFileType(fileExtension: string): Keyword[] {
        const fileType = this.getFileTypeKeywords(fileExtension);
        return fileType ? fileType.allowedKeywords : [];
    }

    /**
     * Get enums for file type with optional extension support (NON-BREAKING)
     */
    static getEnumsForFileType(): EnumDefinition[] {
        return SYLANG_ENUMS;
    }

    static isKeywordAllowed(fileExtension: string, keyword: string): boolean {
        const allKeywords = this.getKeywordsForFileType(fileExtension);
        return allKeywords.some(k => k.name === keyword);
    }

    static getKeywordType(fileExtension: string, keyword: string): KeywordType | null {
        const allKeywords = this.getKeywordsForFileType(fileExtension);

        if (allKeywords.length === 0) {
            // Log for debugging
            console.log(`[KEYWORD MANAGER v${require('./version').SYLANG_VERSION}] No keywords found for extension: ${fileExtension}`);
            return null;
        }

        const keywordDef = allKeywords.find(k => k.name === keyword);
        if (!keywordDef) {
            // Log for debugging - especially for assignedto
            if (keyword === 'assignedto') {
                console.log(`[KEYWORD MANAGER v${require('./version').SYLANG_VERSION}] ❌ ASSIGNEDTO NOT FOUND in ${fileExtension}!`);
                console.log(`[KEYWORD MANAGER v${require('./version').SYLANG_VERSION}] Available keywords:`, allKeywords.map(k => k.name));
            }
            return null;
        }

        // Log successful assignedto detection
        if (keyword === 'assignedto') {
            console.log(`[KEYWORD MANAGER v${require('./version').SYLANG_VERSION}] ✅ ASSIGNEDTO FOUND in ${fileExtension} as type: ${keywordDef.type}`);
        }

        return keywordDef.type;
    }

    static getEnumValues(enumName: string): string[] {
        const enumDef = SYLANG_ENUMS.find(e => e.name === enumName);
        return enumDef?.values || [];
    }

    static getAllowedKeywords(fileExtension: string): string[] {
        const allKeywords = this.getKeywordsForFileType(fileExtension);
        return allKeywords.map(k => k.name);
    }

    static getRequiredKeywords(fileExtension: string): string[] {
        const fileType = this.getFileTypeKeywords(fileExtension);
        return fileType?.requiredKeywords || [];
    }



    static getKeywordAllowsMultiple(fileExtension: string, keyword: string): boolean {
        const fileTypeKeywords = this.getFileTypeKeywords(fileExtension);
        if (!fileTypeKeywords) return false;

        const keywordDef = fileTypeKeywords.allowedKeywords.find(k => k.name === keyword);
        return keywordDef?.allowMultiple || false;
    }
} 