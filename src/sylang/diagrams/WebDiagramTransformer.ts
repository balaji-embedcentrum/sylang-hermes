import { SylangSymbolManagerCore, type SylangSymbol, type DocumentSymbols } from '@sylang-core/symbolManagerCore';
import type { ISylangLogger } from '@sylang-core/interfaces/logger';
import { SYLANG_FILE_TYPES, KeywordType } from '@sylang-core/keywords';
import {
  DiagramData,
  DiagramNode,
  DiagramEdge,
  DiagramType,
  FeatureModelData,
  LayoutOrientation,
  GraphTraversalData,
  GraphNode,
  GraphEdge,
  InternalBlockDiagramData,
  SylangBlock,
  SylangPort,
  SylangConnection,
  UseCaseDiagramData,
  UCDActor,
  UCDFunction,
  UCDRelationship,
  FMEADiagramData,
  FMEAFailureSet,
  FMEAFailureMode,
  FMEAPropagationPath,
  ImpactGraphData,
  StateMachineDiagramData,
  SMDState,
  SMDTransition,
  FaultTreeDiagramData,
  FTAGateData,
  FTAEventData,
  FTAConnectionData,
} from '@sylang-diagrams/types/diagramTypes';
import { FTAParser, type ParsedFTAGate } from './ftaParser';

// Stub position manager — positions are layout hints only, not needed in web
class NoopPositionManager {
  async loadPositionsForDecomposition(_fileUri: string, _type: string, _identifier?: string): Promise<null> {
    return null;
  }
  async loadPositionsForFile(_fileUri: string): Promise<null> {
    return null;
  }
  async loadPositions(_fileUri: string, _diagramType: DiagramType): Promise<null> {
    return null;
  }
}

/**
 * Web port of DiagramDataTransformer.
 * Transforms Sylang DSL files into diagram data structures — no VSCode APIs.
 */
export class WebDiagramTransformer {
  private logger: ISylangLogger;
  private symbolManager: SylangSymbolManagerCore;
  private positionManager: NoopPositionManager;
  private ftaParser: FTAParser;
  private _relationshipKeywordsCache?: Set<string>;
  private _readFile: (path: string) => Promise<string>;

  constructor(symbolManager: SylangSymbolManagerCore, logger: ISylangLogger, readFile?: (path: string) => Promise<string>) {
    this.symbolManager = symbolManager;
    this.logger = logger;
    this.positionManager = new NoopPositionManager();
    this.ftaParser = new FTAParser(logger);
    // Use the provided readFile (from ServerSymbolManager.readFile) or fall back to fs
    this._readFile = readFile ?? (async (p: string) => {
      const fs = await import('node:fs/promises');
      return fs.readFile(p, 'utf8');
    });
    this.logger.info('DIAGRAM DATA TRANSFORMER - Config-aware diagram transformer initialized');
  }

  /** All symbols across all loaded documents */
  private getAllSymbols(): SylangSymbol[] {
    return this.symbolManager.getAllSymbols();
  }

  /** Same as getAllSymbols for raw — both return all symbols */
  private getAllSymbolsRaw(): SylangSymbol[] {
    return this.symbolManager.getAllSymbols();
  }

  /**
   * Main transformation method
   */
  async transformFileToDiagram(
    fileUri: string,
    diagramType: DiagramType,
    focusIdentifier?: string
  ): Promise<{ success: boolean; data?: DiagramData; error?: string }> {
    try {
      this.logger.info(`DIAGRAM DATA TRANSFORMER - Starting transformation for: ${fileUri} to ${diagramType}`);

      const documentSymbols = this.symbolManager.getDocumentSymbols(fileUri);
      this.logger.info(`DIAGRAM DATA TRANSFORMER - Symbol manager returned: ${documentSymbols ? 'DocumentSymbols object' : 'null/undefined'}`);

      if (!documentSymbols) {
        this.logger.error(`DIAGRAM DATA TRANSFORMER - No document symbols found for: ${fileUri}`);
        throw new Error('No document symbols found');
      }

      let diagramData: DiagramData;

      switch (diagramType) {
        case DiagramType.FeatureModel:
          diagramData = this.transformToFeatureModel(documentSymbols);
          break;
        case DiagramType.VariantModel:
          diagramData = await this.transformToVariantModel(fileUri, documentSymbols);
          break;
        case DiagramType.InternalBlockDiagram: {
          const blockData = await this.transformToBlockDiagram(fileUri, documentSymbols);
          diagramData = {
            type: DiagramType.InternalBlockDiagram,
            nodes: blockData.blocks.map(block => ({
              id: block.id,
              name: block.name,
              type: block.level || 'component',
              position: { x: block.x, y: block.y },
              size: { width: block.width, height: block.height },
              properties: {
                description: [block.description || ''],
                level: [block.level || ''],
                safetylevel: [block.safetylevel || ''],
                owner: [block.owner || ''],
                tags: block.tags || [],
                designrationale: [block.designrationale || '']
              }
            })),
            edges: blockData.connections.map(conn => ({
              id: conn.id,
              source: conn.from,
              target: conn.to,
              type: conn.type || 'connection',
              properties: {}
            })),
            metadata: blockData.metadata,
            internalBlockDiagramData: blockData
          };
          break;
        }
        case DiagramType.FunctionalDecomposition: {
          const functionalData = await this.transformToFunctionalDecomposition(fileUri, documentSymbols, focusIdentifier);
          diagramData = {
            type: DiagramType.FunctionalDecomposition,
            nodes: functionalData.blocks.map(block => ({
              id: block.id,
              name: block.name,
              type: block.level || 'function',
              position: { x: block.x, y: block.y },
              size: { width: block.width, height: block.height },
              properties: {
                description: [block.description || ''],
                level: [block.level || ''],
                safetylevel: [block.safetylevel || ''],
                owner: [block.owner || ''],
                tags: block.tags || [],
                designrationale: [block.designrationale || '']
              }
            })),
            edges: functionalData.connections.map(conn => ({
              id: conn.id,
              source: conn.from,
              target: conn.to,
              type: conn.type || 'connection',
              properties: {}
            })),
            metadata: functionalData.metadata,
            internalBlockDiagramData: functionalData
          };
          break;
        }
        case DiagramType.FeatureDecomposition: {
          const featureData = await this.transformToFeatureDecomposition(fileUri, documentSymbols, focusIdentifier);
          diagramData = {
            type: DiagramType.FeatureDecomposition,
            nodes: featureData.blocks.map(block => ({
              id: block.id,
              name: block.name,
              type: block.level || 'feature',
              position: { x: block.x, y: block.y },
              size: { width: block.width, height: block.height },
              properties: {
                description: [block.description || ''],
                level: [block.level || ''],
                safetylevel: [block.safetylevel || ''],
                owner: [block.owner || ''],
                tags: block.tags || [],
                designrationale: [block.designrationale || '']
              }
            })),
            edges: featureData.connections.map(conn => ({
              id: conn.id,
              source: conn.from,
              target: conn.to,
              type: conn.type || 'connection',
              properties: {}
            })),
            metadata: featureData.metadata,
            internalBlockDiagramData: featureData
          };
          break;
        }
        case DiagramType.GraphTraversal:
          diagramData = await this.transformToGraphTraversal(fileUri);
          break;
        case DiagramType.UseCaseDiagram:
          diagramData = await this.transformToUseCaseDiagram(fileUri, documentSymbols);
          break;
        case DiagramType.SequenceDiagram:
          diagramData = await this.transformToSequenceDiagram(fileUri, documentSymbols);
          break;
        case DiagramType.FMEADiagram:
          diagramData = await this.transformToFMEADiagram(fileUri, documentSymbols);
          break;
        case DiagramType.StateMachineDiagram:
          diagramData = await this.transformToStateMachineDiagram(fileUri, documentSymbols);
          break;
        case DiagramType.ImpactGraph:
          diagramData = await this.transformToImpactGraph(fileUri, documentSymbols, focusIdentifier);
          break;
        case DiagramType.FaultTreeAnalysis:
          diagramData = await this.transformToFaultTreeDiagram(fileUri, documentSymbols);
          break;
        default:
          throw new Error(`Unsupported diagram type: ${diagramType}`);
      }

      this.logger.info(`DIAGRAM DATA TRANSFORMER - Transformation successful: ${diagramData.nodes.length} nodes, ${diagramData.edges.length} edges`);
      return { success: true, data: diagramData };
    } catch (error) {
      this.logger.error(`DIAGRAM DATA TRANSFORMER - Transformation failed: ${error}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private transformToFeatureModel(documentSymbols: DocumentSymbols): DiagramData {
    const nodes: DiagramNode[] = [];
    const edges: DiagramEdge[] = [];
    const nodeMap = new Map<string, DiagramNode>();

    const header = documentSymbols.headerSymbol;
    if (header && (header.kind === 'featureset' || header.kind === 'productline')) {
      const rootNode: DiagramNode = {
        id: header.name,
        name: header.name,
        type: header.kind,
        position: { x: 0, y: 0 },
        size: { width: 120, height: 40 },
        properties: { renderMode: ['normal'] }
      };
      nodes.push(rootNode);
      nodeMap.set(header.name, rootNode);
    }

    const features = documentSymbols.definitionSymbols.filter((symbol: SylangSymbol) => symbol.kind === 'feature');

    features.forEach((symbol: SylangSymbol) => {
      const constraintType = this.determineConstraintType(symbol);
      const configAwareNode = this.createConfigAwareNode(symbol, constraintType);
      nodes.push(configAwareNode);
      nodeMap.set(symbol.name, configAwareNode);
    });

    features.forEach((symbol: SylangSymbol) => {
      if (symbol.parentSymbol) {
        const parentNode = nodeMap.get(symbol.parentSymbol);
        const childNode = nodeMap.get(symbol.name);
        if (parentNode && childNode) {
          const edge = this.createConfigAwareEdge(
            `hierarchy_${symbol.parentSymbol}_${symbol.name}`,
            symbol.parentSymbol,
            symbol.name,
            'hierarchy',
            { 'relationship': ['parent-child'] }
          );
          if (edge) edges.push(edge);
        }
      }
    });

    if (header && nodeMap.has(header.name)) {
      features.forEach((symbol: SylangSymbol) => {
        if (!symbol.parentSymbol) {
          const childNode = nodeMap.get(symbol.name);
          if (childNode) {
            edges.push({
              id: `hierarchy_${header.name}_${symbol.name}`,
              source: header.name,
              target: symbol.name,
              type: 'hierarchy',
              properties: { relationship: ['parent-child'] }
            });
          }
        }
      });
    }

    features.forEach((symbol: SylangSymbol) => {
      const requiresProps = symbol.properties.get('requires') || [];
      requiresProps.forEach((requiresValue: string) => {
        let targetFeature = '';
        if (requiresValue.includes('ref feature')) {
          const match = requiresValue.match(/ref\s+feature\s+(\w+)/);
          if (match) targetFeature = match[1];
        } else {
          targetFeature = requiresValue.trim();
        }
        const targetNode = nodeMap.get(targetFeature);
        if (targetNode) {
          edges.push({
            id: `requires_${symbol.name}_${targetFeature}`,
            source: symbol.name,
            target: targetFeature,
            type: 'requires',
            properties: { 'constraint': ['requires'] }
          });
        }
      });

      const excludesProps = symbol.properties.get('excludes') || [];
      excludesProps.forEach((excludesValue: string) => {
        let targetFeature = '';
        if (excludesValue.includes('ref feature')) {
          const match = excludesValue.match(/ref\s+feature\s+(\w+)/);
          if (match) targetFeature = match[1];
        } else {
          targetFeature = excludesValue.trim();
        }
        const targetNode = nodeMap.get(targetFeature);
        if (targetNode) {
          edges.push({
            id: `excludes_${symbol.name}_${targetFeature}`,
            source: symbol.name,
            target: targetFeature,
            type: 'excludes',
            properties: { 'constraint': ['excludes'] }
          });
        }
      });
    });

    const featureModelData: FeatureModelData = {
      type: DiagramType.FeatureModel,
      nodes: nodes as any[],
      edges,
      metadata: {
        title: documentSymbols.headerSymbol?.name || 'Feature Model',
        sourceFile: documentSymbols.headerSymbol?.fileUri || '',
        lastModified: Date.now(),
        nodeCount: nodes.length,
        edgeCount: edges.length
      },
      orientation: LayoutOrientation.TopToBottom,
      rootFeature: this.findRootFeature(features)
    };

    return {
      type: DiagramType.FeatureModel,
      nodes,
      edges,
      metadata: {
        title: documentSymbols.headerSymbol?.name || 'Feature Model',
        sourceFile: documentSymbols.headerSymbol?.fileUri || '',
        lastModified: Date.now(),
        nodeCount: nodes.length,
        edgeCount: edges.length
      },
      featureModelData
    };
  }

  private determineConstraintType(symbol: SylangSymbol): string {
    if (!symbol.properties) return 'mandatory';
    if (symbol.properties.get('mandatory')?.includes('true')) return 'mandatory';
    if (symbol.properties.get('optional')?.includes('true')) return 'optional';
    if (symbol.properties.get('or')?.includes('true')) return 'or';
    if (symbol.properties.get('alternative')?.includes('true')) return 'alternative';
    return 'mandatory';
  }

  private findRootFeature(features: SylangSymbol[]): string {
    const rootFeature = features.find(feature => !feature.parentSymbol);
    return rootFeature ? rootFeature.name : (features.length > 0 ? features[0].name : 'Unknown');
  }

  private async transformToVariantModel(fileUri: string, documentSymbols: DocumentSymbols): Promise<DiagramData> {
    this.logger.info(`DIAGRAM DATA TRANSFORMER - Starting variant model transformation for ${fileUri}`);

    const nodes: DiagramNode[] = [];
    const edges: DiagramEdge[] = [];

    const header = documentSymbols.headerSymbol;
    const rootName = header?.name || 'VariantModelRoot';
    nodes.push({
      id: rootName,
      name: rootName,
      type: header?.kind || 'variantset',
      position: { x: 0, y: 0 },
      size: { width: 140, height: 40 },
      properties: { constraintType: ['root'], renderMode: ['normal'] }
    });

    const fileContent = await this._readFile(fileUri);
    const lines = fileContent.split('\n');

    type TempNode = { name: string; level: number; selected: boolean; constraint?: string };
    const stack: TempNode[] = [{ name: rootName, level: -1, selected: true }];

    function getIndent(line: string): number {
      let count = 0;
      for (const ch of line) {
        if (ch === ' ') count++; else if (ch === '\t') count += 2; else break;
      }
      return Math.floor(count / 2);
    }

    const featureRegex = /extends\s+ref\s+feature\s+(\w+)([\s\w]*)$/;

    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      const t = line.trim();
      if (!t || t.startsWith('//') || t.startsWith('/*')) continue;

      const match = line.match(featureRegex);
      if (!match) continue;

      const level = getIndent(rawLine);
      const name = match[1];
      const flagsStr = match[2] || '';
      const hasSelected = /\bselected\b/.test(flagsStr);
      const constraint = (/(mandatory|optional|or|alternative)/.exec(flagsStr)?.[1]) || undefined;

      while (stack.length && level <= stack[stack.length - 1].level) stack.pop();

      const parent = stack[stack.length - 1];

      if (hasSelected) {
        nodes.push({
          id: name,
          name,
          type: 'feature',
          position: { x: 0, y: 0 },
          size: { width: 120, height: 40 },
          properties: {
            constraintType: [constraint || 'optional'],
            selected: ['true'],
            renderMode: ['normal']
          },
          parent: parent?.name
        });

        const selectedAncestor = [...stack].reverse().find(n => n.selected) || { name: rootName } as TempNode;
        edges.push({
          id: `hierarchy_${selectedAncestor.name}_${name}`,
          source: selectedAncestor.name,
          target: name,
          type: 'hierarchy',
          properties: { relationship: ['parent-child'] }
        });

        stack.push({ name, level, selected: true, constraint });
      } else {
        nodes.push({
          id: name,
          name,
          type: 'feature',
          position: { x: 0, y: 0 },
          size: { width: 120, height: 40 },
          properties: {
            constraintType: [constraint || 'optional'],
            selected: ['false'],
            renderMode: ['grayed']
          },
          parent: parent?.name
        });

        const parentName = parent?.name || rootName;
        edges.push({
          id: `hierarchy_${parentName}_${name}`,
          source: parentName,
          target: name,
          type: 'hierarchy',
          properties: { relationship: ['parent-child'] }
        });

        stack.push({ name, level, selected: false, constraint });
      }
    }

    return {
      type: DiagramType.VariantModel,
      nodes,
      edges,
      metadata: {
        title: `Variant Model - ${rootName}`,
        description: `Variant selection for ${rootName}`,
        sourceFile: fileUri,
        lastModified: Date.now(),
        nodeCount: nodes.length,
        edgeCount: edges.length
      }
    };
  }

  private async transformToBlockDiagram(fileUri: string, documentSymbols: DocumentSymbols): Promise<InternalBlockDiagramData> {
    this.logger.info(`DIAGRAM DATA TRANSFORMER - Starting internal block diagram transformation for ${fileUri}`);

    const mainBlock = documentSymbols.headerSymbol;
    if (!mainBlock || mainBlock.kind !== 'block') {
      throw new Error('Selected file does not contain a block definition');
    }

    const blocks: SylangBlock[] = [];
    const connections: SylangConnection[] = [];

    const mainSylangBlock = await this.createSylangBlockFromSymbol(mainBlock, true);
    blocks.push(mainSylangBlock);

    const decomposestoRefs = mainBlock.properties.get('decomposesto') || [];
    const blockNames: string[] = [];

    const fullString = decomposestoRefs.join(' ');
    const segments = fullString.split(/ref\s+block\s+/).filter(s => s.trim().length > 0);
    for (const segment of segments) {
      const names = segment.split(',').map(name => name.trim()).filter(name => name.length > 0);
      blockNames.push(...names);
    }

    for (const blockName of blockNames) {
      const blockSymbol = this.findBlockSymbolByName(blockName);
      if (blockSymbol) {
        const internalBlock = await this.createSylangBlockFromSymbol(blockSymbol, false);
        blocks.push(internalBlock);
      }
    }

    await this.createPortConnections(blocks, connections);

    const identifier = mainBlock.name;
    const positionsLoaded = await this.loadSavedPositionsForDecomposition(fileUri, 'functional', blocks, identifier, connections);

    if (!positionsLoaded) {
      this.layoutBlocksForIBD(blocks);
    } else {
      this.resizeSystemBoundaryForLoadedPositions(blocks);
    }

    return {
      type: DiagramType.InternalBlockDiagram,
      blocks,
      connections,
      metadata: {
        title: `Internal Block Diagram - ${mainBlock.name}`,
        description: `Internal Block Diagram for ${mainBlock.name}`,
        sourceFile: fileUri,
        lastModified: Date.now(),
        nodeCount: blocks.length,
        edgeCount: connections.length,
        identifier
      }
    };
  }

  private async transformToFunctionalDecomposition(fileUri: string, documentSymbols: DocumentSymbols, focusBlockName?: string): Promise<InternalBlockDiagramData> {
    this.logger.info(`DIAGRAM DATA TRANSFORMER - Starting functional decomposition for ${fileUri}`);

    const mainFunctionset = documentSymbols.headerSymbol;
    if (!mainFunctionset || mainFunctionset.kind !== 'functionset') {
      throw new Error('Selected file does not contain a functionset definition');
    }

    const blocks: SylangBlock[] = [];
    const connections: SylangConnection[] = [];

    if (focusBlockName && mainFunctionset.name !== focusBlockName) {
      const focusFunction = documentSymbols.definitionSymbols.find((symbol: SylangSymbol) =>
        symbol.kind === 'function' && symbol.name === focusBlockName
      );
      if (!focusFunction) throw new Error(`Function '${focusBlockName}' not found in the file`);

      const focusFunctionBlock = await this.createFunctionBlockFromSymbol(focusFunction, true);
      blocks.push(focusFunctionBlock);

      const decomposestoRefs = focusFunction.properties.get('decomposesto') || [];
      const decomposedFunctions: SylangSymbol[] = [];

      for (const decomposestoRef of decomposestoRefs) {
        const functionNames = this.parseDecomposestoReferences(decomposestoRef);
        for (const functionName of functionNames) {
          let decomposedFunction = documentSymbols.definitionSymbols.find((symbol: SylangSymbol) =>
            symbol.kind === 'function' && symbol.name === functionName
          );
          if (!decomposedFunction) {
            decomposedFunction = this.symbolManager.resolveSymbol(functionName, fileUri);
          }
          if (decomposedFunction && decomposedFunction.kind === 'function') {
            decomposedFunctions.push(decomposedFunction);
          }
        }
      }

      for (const func of decomposedFunctions) {
        const functionBlock = await this.createFunctionBlockFromSymbol(func, false);
        blocks.push(functionBlock);
      }

      const allSymbols = [focusFunction, ...decomposedFunctions];
      await this.createFunctionalConnections(allSymbols, blocks, connections);
    } else {
      const identifier = mainFunctionset.name;
      const mainFunctionBlock = await this.createFunctionBlockFromSymbol(mainFunctionset, true);
      blocks.push(mainFunctionBlock);

      const functions = documentSymbols.definitionSymbols.filter((symbol: SylangSymbol) => symbol.kind === 'function');
      for (const func of functions) {
        const functionBlock = await this.createFunctionBlockFromSymbol(func, false);
        blocks.push(functionBlock);
      }

      const allSymbols = [mainFunctionset, ...functions];
      await this.createFunctionalConnections(allSymbols, blocks, connections);
    }

    const identifier = focusBlockName || mainFunctionset.name;
    const positionsLoaded = await this.loadSavedPositionsForDecomposition(fileUri, 'functional', blocks, identifier, connections);
    if (!positionsLoaded) {
      this.layoutFunctionalBlocks(blocks);
    }

    return {
      type: DiagramType.InternalBlockDiagram,
      blocks,
      connections,
      metadata: {
        title: `Functional Decomposition - ${identifier}`,
        description: `Functional Decomposition Diagram for ${identifier}`,
        sourceFile: fileUri,
        lastModified: Date.now(),
        nodeCount: blocks.length,
        edgeCount: connections.length,
        identifier
      }
    };
  }

  private async transformToFeatureDecomposition(fileUri: string, documentSymbols: DocumentSymbols, focusBlockName?: string): Promise<InternalBlockDiagramData> {
    this.logger.info(`DIAGRAM DATA TRANSFORMER - Starting feature decomposition for ${fileUri}`);

    const mainFeatureset = documentSymbols.headerSymbol;
    if (!mainFeatureset || mainFeatureset.kind !== 'featureset') {
      throw new Error('Selected file does not contain a featureset definition');
    }

    const blocks: SylangBlock[] = [];
    const connections: SylangConnection[] = [];

    if (focusBlockName && mainFeatureset.name !== focusBlockName) {
      const focusFeature = documentSymbols.definitionSymbols.find((symbol: SylangSymbol) =>
        symbol.kind === 'feature' && symbol.name === focusBlockName
      );
      if (!focusFeature) throw new Error(`Feature '${focusBlockName}' not found in the file`);

      const focusFeatureBlock = await this.createFeatureBlockFromSymbol(focusFeature, true);
      blocks.push(focusFeatureBlock);

      const decomposestoRefs = focusFeature.properties.get('decomposesto') || [];
      const decomposedFunctions: SylangSymbol[] = [];

      for (const decomposestoRef of decomposestoRefs) {
        const functionNames = this.parseDecomposestoReferences(decomposestoRef);
        for (const functionName of functionNames) {
          let decomposedFunction = documentSymbols.definitionSymbols.find((symbol: SylangSymbol) =>
            symbol.kind === 'function' && symbol.name === functionName
          );
          if (!decomposedFunction) {
            decomposedFunction = this.symbolManager.resolveSymbol(functionName, fileUri);
          }
          if (decomposedFunction) decomposedFunctions.push(decomposedFunction);
        }
      }

      for (const functionSymbol of decomposedFunctions) {
        const functionBlock = await this.createFunctionBlockFromSymbol(functionSymbol, false);
        blocks.push(functionBlock);
      }

      await this.createFeatureConnections(blocks, focusFeatureBlock, decomposedFunctions, true);
    } else {
      const featuresetBlock = await this.createFeatureBlockFromSymbol(mainFeatureset, true);
      blocks.push(featuresetBlock);

      const parentFeatures = documentSymbols.definitionSymbols.filter((symbol: SylangSymbol) =>
        symbol.kind === 'feature' && symbol.parentSymbol === mainFeatureset.name
      );

      for (const featureSymbol of parentFeatures) {
        const featureBlock = await this.createFeatureBlockFromSymbol(featureSymbol, false);
        blocks.push(featureBlock);
      }

      await this.createFeatureConnections(blocks, featuresetBlock, parentFeatures, false);
    }

    const identifier = focusBlockName || mainFeatureset.name;
    const positionsLoaded = await this.loadSavedPositionsForDecomposition(fileUri, 'feature', blocks, identifier, connections);
    if (!positionsLoaded) {
      this.layoutBlocksForIBD(blocks);
    }

    return {
      type: DiagramType.InternalBlockDiagram,
      blocks,
      connections,
      metadata: {
        title: `Feature Decomposition - ${identifier}`,
        description: `Feature Decomposition Diagram for ${identifier}`,
        sourceFile: fileUri,
        lastModified: Date.now(),
        nodeCount: blocks.length,
        edgeCount: connections.length,
        identifier
      }
    };
  }

  private async createFeatureBlockFromSymbol(symbol: SylangSymbol, _isMainBlock: boolean): Promise<SylangBlock> {
    const ports: SylangPort[] = [];
    const needsRefs = symbol.properties.get('needs') || [];
    const providesRefs = symbol.properties.get('provides') || [];

    for (const needRef of needsRefs) {
      if (Array.isArray(needRef) && needRef.length >= 3 && needRef[0] === 'ref') {
        const refType = needRef[1];
        const refNames = needRef.slice(2);
        for (const refName of refNames) {
          const splitNames = refName.includes(',') ? refName.split(',').map((n: string) => n.trim()) : [refName];
          for (const name of splitNames) {
            ports.push({ id: `${symbol.name}_needs_${name}`, name, direction: 'in', porttype: refType as any, x: 0, y: 0, width: 80, height: 20 });
          }
        }
      }
    }

    for (const offerRef of providesRefs) {
      if (Array.isArray(offerRef) && offerRef.length >= 3 && offerRef[0] === 'ref') {
        const refType = offerRef[1];
        const refNames = offerRef.slice(2);
        for (const refName of refNames) {
          const splitNames = refName.includes(',') ? refName.split(',').map((n: string) => n.trim()) : [refName];
          for (const name of splitNames) {
            ports.push({ id: `${symbol.name}_provides_${name}`, name, direction: 'out', porttype: refType as any, x: 0, y: 0, width: 80, height: 20 });
          }
        }
      }
    }

    const block: SylangBlock = {
      id: symbol.name,
      name: symbol.name,
      level: (symbol.properties.get('level')?.[0] as any) || 'object',
      x: 0, y: 0,
      width: 200, height: 100,
      ports,
      fileUri: symbol.fileUri.toString()
    };

    this.positionPortsOnBlock(block);
    return block;
  }

  private async createFeatureConnections(
    blocks: SylangBlock[],
    mainBlock: SylangBlock,
    _internalElements: SylangSymbol[],
    isFeatureLevel: boolean
  ): Promise<void> {
    const connections: SylangConnection[] = [];
    const internalBlocks = blocks.filter(b => b.id !== mainBlock.id);

    // Connect matching ports between main and internal blocks
    for (const internalBlock of internalBlocks) {
      if (isFeatureLevel) {
        const featureInputPorts = mainBlock.ports.filter(p => p.direction === 'in');
        const functionInputPorts = internalBlock.ports.filter(p => p.direction === 'in');
        for (const featurePort of featureInputPorts) {
          const matchingFunctionPort = functionInputPorts.find(p => p.name === featurePort.name);
          if (matchingFunctionPort) {
            connections.push({ id: `conn_${mainBlock.id}_${featurePort.id}_to_${internalBlock.id}_${matchingFunctionPort.id}`, from: featurePort.id, to: matchingFunctionPort.id, type: 'data' });
          }
        }
      }
    }
  }

  private async createSylangBlockFromSymbol(symbol: SylangSymbol, _isMainBlock: boolean): Promise<SylangBlock> {
    const ports: SylangPort[] = [];
    const needsRefs = symbol.properties.get('needs') || [];
    const providesRefs = symbol.properties.get('provides') || [];

    for (const needRef of needsRefs) {
      const parsedNeeds = this.parseFunctionReference(needRef);
      for (const parsed of parsedNeeds) {
        const operationSymbol = this.symbolManager.resolveSymbol(parsed.name, symbol.fileUri);
        const safetylevel = operationSymbol?.properties.get('safetylevel')?.[0];
        let direction: 'in' | 'out' = 'in';
        let side: 'left' | 'right' | undefined;
        if (parsed.side === 'right') { direction = 'in'; side = 'right'; }
        else if (parsed.side === 'left') { direction = 'in'; side = 'left'; }
        ports.push({ id: `${symbol.name}_needs_${parsed.name}`, name: parsed.name, direction, side, porttype: needRef.includes('operation') ? 'operation' : 'signal', safetylevel, x: 0, y: 0, width: 80, height: 20 });
      }
    }

    for (const provideRef of providesRefs) {
      const parsedProvides = this.parseFunctionReference(provideRef);
      for (const parsed of parsedProvides) {
        const operationSymbol = this.symbolManager.resolveSymbol(parsed.name, symbol.fileUri);
        const safetylevel = operationSymbol?.properties.get('safetylevel')?.[0];
        let direction: 'in' | 'out' = 'out';
        let side: 'left' | 'right' | undefined;
        if (parsed.side === 'left') { direction = 'out'; side = 'left'; }
        else if (parsed.side === 'right') { direction = 'out'; side = 'right'; }
        ports.push({ id: `${symbol.name}_provides_${parsed.name}`, name: parsed.name, direction, side, porttype: provideRef.includes('operation') ? 'operation' : 'signal', safetylevel, x: 0, y: 0, width: 80, height: 20 });
      }
    }

    const block: SylangBlock = {
      id: symbol.name,
      name: symbol.name,
      description: symbol.properties.get('description')?.[0],
      level: symbol.properties.get('level')?.[0] as any,
      safetylevel: symbol.properties.get('safetylevel')?.[0],
      owner: symbol.properties.get('owner')?.[0],
      tags: symbol.properties.get('tags'),
      designrationale: symbol.properties.get('designrationale')?.[0],
      x: 0, y: 0,
      width: Math.max(200, ports.length * 30 + 100),
      height: Math.max(120, ports.length * 25 + 60) + 10,
      ports,
      decomposesto: symbol.properties.get('decomposesto'),
      enables: symbol.properties.get('enables'),
      inherits: symbol.properties.get('inherits'),
      config: symbol.properties.get('config')?.[0],
      fileUri: symbol.fileUri
    };

    this.positionPortsOnBlock(block);
    return block;
  }

  private positionPortsOnBlock(block: SylangBlock): void {
    const inputPorts = block.ports.filter(p => p.direction === 'in');
    const outputPorts = block.ports.filter(p => p.direction === 'out');
    const portWidth = 8, portHeight = 12, titleOffset = 48, portMargin = 15, minPortSpacing = 18;
    const availableHeight = Math.max(0, block.height - titleOffset - portMargin * 2);

    const computePortPositions = (portCount: number): number[] => {
      if (portCount === 0) return [];
      if (portCount === 1) return [block.y + titleOffset + availableHeight / 2];
      const totalMinSpacing = (portCount - 1) * minPortSpacing;
      const step = totalMinSpacing <= availableHeight ? availableHeight / (portCount - 1) : availableHeight / (portCount - 1);
      return Array.from({ length: portCount }, (_, i) => block.y + titleOffset + portMargin + i * step);
    };

    const inputPositions = computePortPositions(inputPorts.length);
    inputPorts.forEach((port, index) => {
      port.x = block.x - portWidth / 2;
      port.y = inputPositions[index] - portHeight / 2;
      port.width = portWidth;
      port.height = portHeight;
    });

    const outputPositions = computePortPositions(outputPorts.length);
    outputPorts.forEach((port, index) => {
      port.x = block.x + block.width - portWidth / 2;
      port.y = outputPositions[index] - portHeight / 2;
      port.width = portWidth;
      port.height = portHeight;
    });
  }

  private findBlockSymbolByName(blockName: string): SylangSymbol | null {
    const allSymbols = this.getAllSymbols();
    return allSymbols.find(symbol => symbol.name === blockName && symbol.kind === 'block' && symbol.type === 'header') || null;
  }

  private async createPortConnections(blocks: SylangBlock[], connections: SylangConnection[]): Promise<void> {
    const connectionExists = (fromId: string, toId: string) => connections.some(c => c.from === fromId && c.to === toId);
    const internalBlocks = blocks.length > 1 ? blocks.slice(1) : blocks;

    for (const block of internalBlocks) {
      const blockSymbol = this.findBlockSymbolByName(block.name);
      if (!blockSymbol) continue;
      const needsRefs = blockSymbol.properties.get('needs') || [];
      for (const needRef of needsRefs) {
        const parsedNeeds = this.parseFunctionReference(needRef);
        for (const parsed of parsedNeeds) {
          const neededInterfaceName = parsed.name;
          if (!neededInterfaceName) continue;
          const inputPort = block.ports.find(p => p.direction === 'in' && p.name === neededInterfaceName);
          if (!inputPort) continue;
          const providingBlock = internalBlocks.find(otherBlock => otherBlock !== block && otherBlock.ports.some(p => p.direction === 'out' && p.name === neededInterfaceName));
          if (providingBlock) {
            const outputPort = providingBlock.ports.find(p => p.direction === 'out' && p.name === neededInterfaceName);
            if (outputPort && !connectionExists(outputPort.id, inputPort.id)) {
              connections.push({ id: `${outputPort.id}_to_${inputPort.id}`, from: outputPort.id, to: inputPort.id, type: 'data-flow' });
            }
          }
        }
      }
    }

    if (blocks.length > 1) {
      const containerBlock = blocks[0];
      const internalBlocksSlice = blocks.slice(1);
      for (const containerInputPort of containerBlock.ports.filter(p => p.direction === 'in')) {
        for (const internalBlock of internalBlocksSlice) {
          const matchingInternalPort = internalBlock.ports.find(p => p.direction === 'in' && p.name === containerInputPort.name);
          if (matchingInternalPort && !connectionExists(containerInputPort.id, matchingInternalPort.id)) {
            connections.push({ id: `container_${containerInputPort.id}_to_internal_${matchingInternalPort.id}`, from: containerInputPort.id, to: matchingInternalPort.id, type: 'container-to-internal' });
          }
        }
      }
      for (const internalBlock of internalBlocksSlice) {
        for (const internalOutputPort of internalBlock.ports.filter(p => p.direction === 'out')) {
          const matchingContainerPort = containerBlock.ports.find(p => p.direction === 'out' && p.name === internalOutputPort.name);
          if (matchingContainerPort && !connectionExists(internalOutputPort.id, matchingContainerPort.id)) {
            connections.push({ id: `internal_${internalOutputPort.id}_to_container_${matchingContainerPort.id}`, from: internalOutputPort.id, to: matchingContainerPort.id, type: 'internal-to-container' });
          }
        }
      }
    }
  }

  private layoutBlocksForIBD(blocks: SylangBlock[]): void {
    if (blocks.length === 0) return;
    const mainBlock = blocks[0];
    const internalBlocks = blocks.slice(1);
    this.calculateBlockSizes(blocks);
    if (internalBlocks.length === 0) {
      mainBlock.x = 100; mainBlock.y = 100;
      mainBlock.width = Math.max(400, mainBlock.width);
      mainBlock.height = Math.max(200, mainBlock.height);
    } else {
      this.applyForceSimulationLayout(blocks);
    }
    blocks.forEach(block => this.positionPortsOnBlock(block));
  }

  private calculateBlockSizes(blocks: SylangBlock[]): void {
    blocks.forEach(block => {
      const inputPorts = block.ports.filter(p => p.direction === 'in');
      const outputPorts = block.ports.filter(p => p.direction === 'out');
      const maxPorts = Math.max(inputPorts.length, outputPorts.length);
      const textWidth = Math.max(block.name.length * 8 + 40, block.ports.length > 0 ? Math.max(...block.ports.map(p => p.name.length * 7 + 20)) : 0);
      const portHeight = maxPorts > 0 ? (maxPorts * 25 + 20 * 2 + 40) : 120;
      block.width = Math.max(200, textWidth);
      block.height = Math.max(120, portHeight);
    });
  }

  private applyForceSimulationLayout(blocks: SylangBlock[]): void {
    const mainBlock = blocks[0];
    const internalBlocks = blocks.slice(1);
    const containerMargin = 100, minContainerWidth = 800, minContainerHeight = 600;
    const nodes = internalBlocks.map((block, index) => ({ id: block.id, block, x: 300 + (index % 3) * 250, y: 200 + Math.floor(index / 3) * 200, vx: 0, vy: 0 }));
    const iterations = 100, repulsionStrength = 2000, attractionStrength = 0.1, damping = 0.9;

    for (let iter = 0; iter < iterations; iter++) {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x, dy = nodes[j].y - nodes[i].y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = repulsionStrength / (distance * distance);
          const fx = (dx / distance) * force, fy = (dy / distance) * force;
          nodes[i].vx -= fx; nodes[i].vy -= fy;
          nodes[j].vx += fx; nodes[j].vy += fy;
        }
      }
      for (const node of nodes) { node.x += node.vx; node.y += node.vy; node.vx *= damping; node.vy *= damping; }
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(node => {
      node.block.x = node.x; node.block.y = node.y;
      minX = Math.min(minX, node.x); minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + node.block.width); maxY = Math.max(maxY, node.y + node.block.height);
    });

    const containerX = minX - containerMargin, containerY = minY - containerMargin - 40;
    mainBlock.x = containerX; mainBlock.y = containerY;
    mainBlock.width = Math.max(minContainerWidth, (maxX - minX) + containerMargin * 2);
    mainBlock.height = Math.max(minContainerHeight, (maxY - minY) + containerMargin * 2 + 40);
  }

  public async transformToGraphTraversal(sourceFileUri: string): Promise<GraphTraversalData> {
    this.logger.info('DIAGRAM DATA TRANSFORMER - Starting graph traversal transformation');
    // Collect unique symbols from all documents — headers + definitions only.
    // Do NOT use getAllSymbols() which includes importedSymbols (massive duplication).
    const seen = new Set<string>();
    const allSymbols: SylangSymbol[] = [];
    const excludedExts = new Set(['spr', 'agt', 'ucd', 'seq']);
    for (const doc of this.symbolManager.getDocumentSymbols ? [] : []) { /* type guard */ }
    // Access documents via the symbol manager's public API
    const rawSymbols = this.symbolManager.getAllSymbols();
    for (const sym of rawSymbols) {
      const key = `${sym.fileUri}:${sym.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      // Skip diagram/management file types
      const ext = sym.fileUri?.split('.').pop() ?? '';
      if (excludedExts.has(ext)) continue;
      // Skip disabled configs
      if (sym.configValue === 0) continue;
      allSymbols.push(sym);
    }
    this.logger.info(`DIAGRAM DATA TRANSFORMER - ${allSymbols.length} unique symbols (from ${rawSymbols.length} total)`);
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const clusters = new Map<string, string[]>();
    const fileGroups = new Map<string, string[]>();

    for (const symbol of allSymbols) {
      const nodeId = `${symbol.fileUri}:${symbol.name}`;
      const fileExtension = symbol.fileUri.split('.').pop() || '';
      const node: GraphNode = {
        id: nodeId,
        name: symbol.name,
        type: symbol.kind,
        symbolType: symbol.type as 'hdef' | 'def',
        fileUri: symbol.fileUri,
        position: { x: 0, y: 0 },
        size: { width: 120, height: 60 },
        properties: Object.fromEntries(symbol.properties),
        parent: symbol.parentSymbol,
        children: symbol.children.map(child => `${symbol.fileUri}:${child.name}`),
        connections: [],
        configValue: symbol.configValue,
        indentLevel: symbol.indentLevel
      };
      nodes.push(node);
      if (!clusters.has(fileExtension)) clusters.set(fileExtension, []);
      clusters.get(fileExtension)!.push(nodeId);
      if (!fileGroups.has(symbol.fileUri)) fileGroups.set(symbol.fileUri, []);
      fileGroups.get(symbol.fileUri)!.push(nodeId);
    }

    const createParentChildEdges = (parentSymbol: any, parentNodeId: string) => {
      for (const child of parentSymbol.children) {
        const childNodeId = `${parentSymbol.fileUri}:${child.name}`;
        edges.push({ id: `${parentNodeId}-${childNodeId}-parentof`, source: parentNodeId, target: childNodeId, type: 'parentof', relationType: 'parentof', properties: { 'parentof': [child.name] } });
        edges.push({ id: `${childNodeId}-${parentNodeId}-childof`, source: childNodeId, target: parentNodeId, type: 'childof', relationType: 'childof', properties: { 'childof': [parentSymbol.name] } });
        const parentNode = nodes.find(n => n.id === parentNodeId);
        const childNode = nodes.find(n => n.id === childNodeId);
        if (parentNode && !parentNode.connections.includes(childNodeId)) parentNode.connections.push(childNodeId);
        if (childNode && !childNode.connections.includes(parentNodeId)) childNode.connections.push(parentNodeId);
        if (child.children && child.children.length > 0) createParentChildEdges(child, childNodeId);
      }
    };

    for (const symbol of allSymbols) {
      if (symbol.type === 'header') createParentChildEdges(symbol, `${symbol.fileUri}:${symbol.name}`);
      else if (symbol.type === 'definition' && symbol.children && symbol.children.length > 0) createParentChildEdges(symbol, `${symbol.fileUri}:${symbol.name}`);
    }

    for (const symbol of allSymbols) {
      const sourceNodeId = `${symbol.fileUri}:${symbol.name}`;
      for (const [propertyName, values] of symbol.properties) {
        if (this.isReferenceProperty(propertyName)) {
          for (const value of values) {
            let cleanValue = value.replace(/^ref\s+\w+\s+/, '').replace(/^ref\s+/, '').trim();
            const targetIdentifiers = cleanValue.split(',').map(id => id.trim()).filter(id => id.length > 0);
            for (const targetId of targetIdentifiers) {
              const targetSymbol = this.findReferencedSymbol(targetId, symbol.fileUri);
              if (targetSymbol) {
                const targetNodeId = `${targetSymbol.fileUri}:${targetSymbol.name}`;
                edges.push({ id: `${sourceNodeId}-${targetNodeId}-${propertyName}`, source: sourceNodeId, target: targetNodeId, type: propertyName, relationType: propertyName, properties: { [propertyName]: [targetId] } });
                const sourceNode = nodes.find(n => n.id === sourceNodeId);
                const targetNode = nodes.find(n => n.id === targetNodeId);
                if (sourceNode && !sourceNode.connections.includes(targetNodeId)) sourceNode.connections.push(targetNodeId);
                if (targetNode && !targetNode.connections.includes(sourceNodeId)) targetNode.connections.push(sourceNodeId);
              }
            }
          }
        }
      }
    }

    const clustersObject: { [key: string]: string[] } = {};
    clusters.forEach((nodeIds, fileExt) => { clustersObject[fileExt] = nodeIds; });
    const fileGroupsObject: { [key: string]: string[] } = {};
    fileGroups.forEach((nodeIds, filePath) => { fileGroupsObject[filePath] = nodeIds; });

    return {
      type: DiagramType.GraphTraversal,
      nodes,
      edges,
      clusters: clustersObject,
      fileGroups: fileGroupsObject,
      metadata: {
        title: 'Sylang: Traceability View',
        description: 'Complete project graph showing all nodes and relationships',
        sourceFile: sourceFileUri,
        lastModified: Date.now(),
        nodeCount: nodes.length,
        edgeCount: edges.length
      }
    };
  }

  private isReferenceProperty(propertyName: string): boolean {
    return this.getAllRelationshipKeywords().has(propertyName);
  }

  private getAllRelationshipKeywords(): Set<string> {
    if (!this._relationshipKeywordsCache) {
      this._relationshipKeywordsCache = new Set<string>();
      for (const fileType of SYLANG_FILE_TYPES) {
        for (const keyword of fileType.allowedKeywords) {
          if (keyword.type === KeywordType.RELATION) {
            this._relationshipKeywordsCache.add(keyword.name);
          }
        }
      }
    }
    return this._relationshipKeywordsCache;
  }

  private findReferencedSymbol(identifier: string, sourceFileUri: string): SylangSymbol | undefined {
    return this.symbolManager.resolveSymbol(identifier, sourceFileUri);
  }

  private symbolUsesDisabledConfig(symbol: SylangSymbol): boolean {
    if (this.symbolHasDisabledConfig(symbol)) return true;
    if (this.hasParentWithDisabledConfig(symbol)) return true;
    return false;
  }

  private symbolHasDisabledConfig(symbol: SylangSymbol): boolean {
    for (const [propertyName, propertyValues] of symbol.properties.entries()) {
      if (propertyName === 'when') {
        let configName: string | undefined;
        if (propertyValues.length >= 3 && propertyValues[0] === 'ref' && propertyValues[1] === 'config') {
          configName = propertyValues[2];
        } else if (propertyValues.length === 1 && propertyValues[0].startsWith('ref config ')) {
          const parts = propertyValues[0].split(' ');
          if (parts.length >= 3) configName = parts[2];
        }
        if (configName) {
          const configValue = this.resolveConfigValueLocal(configName);
          if (configValue === 0) return true;
        }
      }
    }
    return false;
  }

  private hasParentWithDisabledConfig(symbol: SylangSymbol): boolean {
    if (!symbol.parentSymbol) return false;
    const allSymbols = this.getAllSymbolsRaw();
    const parentSymbol = allSymbols.find(s => s.fileUri === symbol.fileUri && s.name === symbol.parentSymbol);
    if (parentSymbol) {
      if (this.symbolHasDisabledConfig(parentSymbol)) return true;
      return this.hasParentWithDisabledConfig(parentSymbol);
    }
    return false;
  }

  private resolveConfigValueLocal(configName: string): number | undefined {
    const allSymbols = this.getAllSymbolsRaw();
    for (const symbol of allSymbols) {
      if (symbol.kind === 'config' && symbol.name === configName) return symbol.configValue;
    }
    return undefined;
  }

  private createConfigAwareNode(symbol: SylangSymbol, constraintType?: string): DiagramNode {
    const usesDisabledConfig = this.symbolUsesDisabledConfig(symbol);
    const renderMode = usesDisabledConfig ? 'grayed' : 'normal';

    const properties: { [key: string]: string[] } = {
      'description': [symbol.properties.get('description')?.join(' ') || ''],
      'owner': symbol.properties.get('owner') || [],
      'tags': symbol.properties.get('tags') || [],
      'safetylevel': symbol.properties.get('safetylevel') || [],
      'mandatory': symbol.properties.get('mandatory') || [],
      'optional': symbol.properties.get('optional') || [],
      'or': symbol.properties.get('or') || [],
      'alternative': symbol.properties.get('alternative') || [],
      'requires': symbol.properties.get('requires') || [],
      'excludes': symbol.properties.get('excludes') || [],
      'renderMode': [renderMode],
      'configInfo': [renderMode === 'normal' ? 'enabled' : 'disabled'],
      'isVisible': [renderMode === 'normal' ? 'true' : 'false']
    };

    if (constraintType) properties['constraintType'] = [constraintType];

    return {
      id: symbol.name,
      name: symbol.name,
      type: symbol.kind,
      position: { x: 0, y: 0 },
      size: { width: 200, height: 60 },
      properties
    };
  }

  private createConfigAwareEdge(id: string, sourceId: string, targetId: string, edgeType: string, properties: { [key: string]: string[] }): DiagramEdge | null {
    return {
      id, source: sourceId, target: targetId, type: edgeType,
      properties: { ...properties, 'sourceConfigInfo': ['enabled'], 'targetConfigInfo': ['enabled'] }
    };
  }

  private async transformToUseCaseDiagram(fileUri: string, documentSymbols: DocumentSymbols): Promise<UseCaseDiagramData> {
    this.logger.info(`UCD TRANSFORMER - Transforming UCD file: ${fileUri}`);
    const fileContent = await this._readFile(fileUri);
    const actors: UCDActor[] = [];
    const functions: UCDFunction[] = [];
    const relationships: UCDRelationship[] = [];
    let useCaseName = documentSymbols.headerSymbol?.name || 'Unknown Use Case';
    const lines = fileContent.split('\n');
    const uniqueFunctions = new Map<string, UCDFunction>();
    const uniqueActors = new Map<string, UCDActor>();

    for (let i = 0; i < lines.length; i++) {
      const trimmedLine = lines[i].trim();
      if (!trimmedLine || trimmedLine.startsWith('//')) continue;
      const tokens = trimmedLine.split(/\s+/);
      if (tokens[0] === 'def' && tokens[1] === 'actor') {
        const actorName = tokens[2];
        let actorType: 'primary' | 'secondary' = 'primary';
        for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
          const nextLine = lines[j].trim();
          if (!nextLine || nextLine.startsWith('//')) continue;
          if (nextLine.startsWith('def ')) break;
          if (nextLine.startsWith('actortype ')) {
            const m = nextLine.match(/actortype\s+(primary|secondary)/);
            if (m) actorType = m[1] as any;
            break;
          }
        }
        uniqueActors.set(actorName, { id: `actor-${actorName}`, name: actorName, position: { x: 0, y: 0 }, size: { width: 60, height: 90 }, type: 'actor', actortype: actorType, associatedFunctions: [], includesFunctions: [], indentLevel: 0, properties: { renderMode: ['normal'] } });
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const trimmedLine = lines[i].trim();
      if (!trimmedLine || trimmedLine.startsWith('//')) continue;
      const tokens = trimmedLine.split(/\s+/);
      if (tokens[0] === 'def' && tokens[1] === 'usecase') {
        const useCaseId = tokens[2];
        let fromType = '', fromName = '', toType = '', toName = '', connectionType = '';
        for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
          const nextLine = lines[j].trim();
          if (!nextLine || nextLine.startsWith('//')) continue;
          if (nextLine.startsWith('def ')) break;
          const nextTokens = nextLine.split(/\s+/);
          if (nextTokens[0] === 'from' && nextTokens[1] === 'ref') { fromType = nextTokens[2]; fromName = nextTokens[3]; }
          else if (nextTokens[0] === 'to' && nextTokens[1] === 'ref') { toType = nextTokens[2]; toName = nextTokens[3]; }
          else if (nextTokens[0] === 'connection') connectionType = nextTokens[1];
        }
        if (fromType && fromName && toType && toName && connectionType) {
          if (toType === 'function' && !uniqueFunctions.has(toName)) {
            uniqueFunctions.set(toName, { id: `function-${toName}`, name: toName, functionName: toName, position: { x: 0, y: 0 }, size: { width: 200, height: 60 }, type: 'function', parentActor: fromType === 'actor' ? fromName : '', relationshipType: connectionType as any, indentLevel: 0, properties: { renderMode: ['normal'] } });
          }
          if (fromType === 'function' && !uniqueFunctions.has(fromName)) {
            uniqueFunctions.set(fromName, { id: `function-${fromName}`, name: fromName, functionName: fromName, position: { x: 0, y: 0 }, size: { width: 200, height: 60 }, type: 'function', parentActor: '', relationshipType: 'associated', indentLevel: 0, properties: { renderMode: ['normal'] } });
          }
          relationships.push({ id: `rel-${useCaseId}`, source: `${fromType}-${fromName}`, target: `${toType}-${toName}`, type: connectionType as any, style: connectionType === 'associated' ? 'solid' : 'dashed', actorId: fromType === 'actor' ? `actor-${fromName}` : (toType === 'actor' ? `actor-${toName}` : ''), functionId: toType === 'function' ? `function-${toName}` : (fromType === 'function' ? `function-${fromName}` : ''), properties: { renderMode: ['normal'] } });
        }
      }
    }

    actors.push(...Array.from(uniqueActors.values()));
    functions.push(...Array.from(uniqueFunctions.values()));

    return { type: DiagramType.UseCaseDiagram, nodes: [...actors, ...functions], edges: relationships, metadata: { title: useCaseName, description: `Use Case Diagram for ${useCaseName}`, sourceFile: fileUri, lastModified: Date.now(), nodeCount: actors.length + functions.length, edgeCount: relationships.length }, actors, functions, relationships, useCaseName, useCaseProperties: {} };
  }

  private getIndentLevel(line: string): number {
    let indent = 0;
    for (const char of line) {
      if (char === ' ') indent++;
      else if (char === '\t') indent += 4;
      else break;
    }
    return Math.floor(indent / 2);
  }

  private async transformToSequenceDiagram(fileUri: string, documentSymbols: DocumentSymbols): Promise<DiagramData> {
    this.logger.info(`SEQ TRANSFORMER - Transforming SEQ file: ${fileUri}`);
    const fileContent = await this._readFile(fileUri);
    let sequenceName = documentSymbols.headerSymbol?.name || 'Unknown Sequence';
    let sequenceDescription = documentSymbols.headerSymbol?.properties.get('description')?.[0] || '';
    const participants = new Map<string, any>();
    const messages: any[] = [];
    const fragments: any[] = [];
    const lines = fileContent.split('\n');
    let messageIndex = 0;
    let fragmentStack: any[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const indentLevel = this.getIndentLevel(lines[i]);
      if (line.startsWith('def fragment')) {
        const fragmentName = line.split(' ')[2];
        const newFragment = { id: `f${fragments.length + 1}`, name: fragmentName, type: 'alt', condition: '', startY: 0, endY: 0, participants: [], messages: [], sequenceIds: [], indentLevel };
        fragments.push(newFragment);
        while (fragmentStack.length > 0 && fragmentStack[fragmentStack.length - 1].indentLevel >= indentLevel) fragmentStack.pop();
        fragmentStack.push(newFragment);
      } else if (fragmentStack.length > 0 && line.startsWith('fragmenttype')) {
        fragmentStack[fragmentStack.length - 1].type = line.split(' ')[1];
      } else if (fragmentStack.length > 0 && line.startsWith('condition')) {
        fragmentStack[fragmentStack.length - 1].condition = line.replace('condition', '').replace(/"/g, '').trim();
      } else if (line.startsWith('def sequence')) {
        const sequenceId = line.split(' ')[2];
        let fromBlock = '', toBlock = '', flowMessage = '', flowType = 'operation';
        for (let j = i + 1; j < lines.length && j < i + 10; j++) {
          const nextLine = lines[j].trim();
          if (nextLine.startsWith('from ref block')) fromBlock = nextLine.replace('from ref block', '').trim();
          else if (nextLine.startsWith('from ref function')) fromBlock = nextLine.replace('from ref function', '').trim();
          else if (nextLine.startsWith('to ref block')) toBlock = nextLine.replace('to ref block', '').trim();
          else if (nextLine.startsWith('to ref function')) toBlock = nextLine.replace('to ref function', '').trim();
          else if (nextLine.startsWith('flow ref operation')) { flowMessage = nextLine.replace('flow ref operation', '').trim(); flowType = 'operation'; }
          else if (nextLine.startsWith('flow ref signal')) { flowMessage = nextLine.replace('flow ref signal', '').trim(); flowType = 'signal'; }
          else if (nextLine.startsWith('def ')) break;
        }
        if (fromBlock && !participants.has(fromBlock)) {
          const blockSymbol = documentSymbols.definitionSymbols.find(s => s.name === fromBlock);
          const participantRenderMode = blockSymbol && this.symbolUsesDisabledConfig(blockSymbol) ? 'grayed' : 'normal';
          participants.set(fromBlock, { id: `p${participants.size + 1}`, name: fromBlock, blockName: fromBlock, x: (participants.size) * 200 + 100, properties: { renderMode: [participantRenderMode] } });
        }
        if (toBlock && !participants.has(toBlock)) {
          const blockSymbol = documentSymbols.definitionSymbols.find(s => s.name === toBlock);
          const participantRenderMode = blockSymbol && this.symbolUsesDisabledConfig(blockSymbol) ? 'grayed' : 'normal';
          participants.set(toBlock, { id: `p${participants.size + 1}`, name: toBlock, blockName: toBlock, x: (participants.size) * 200 + 100, properties: { renderMode: [participantRenderMode] } });
        }
        if (fromBlock && toBlock && flowMessage) {
          const sequenceSymbol = documentSymbols.definitionSymbols.find(s => s.name === sequenceId);
          const renderMode = sequenceSymbol && this.symbolUsesDisabledConfig(sequenceSymbol) ? 'grayed' : 'normal';
          const message = { id: `m${++messageIndex}`, from: participants.get(fromBlock)?.id, to: participants.get(toBlock)?.id, messageId: flowMessage, messageType: flowType, y: 150 + (messageIndex - 1) * 80, hasResponse: flowType === 'operation', sequenceId, properties: { renderMode: [renderMode] } };
          messages.push(message);
          fragmentStack.forEach(fragment => fragment.sequenceIds.push(sequenceId));
        }
      }
    }

    fragments.forEach(fragment => {
      const fragmentMessages = messages.filter(msg => fragment.sequenceIds && fragment.sequenceIds.includes(msg.sequenceId));
      if (fragmentMessages.length > 0) {
        fragment.startY = Math.min(...fragmentMessages.map((msg: any) => msg.y)) - 30;
        fragment.endY = Math.max(...fragmentMessages.map((msg: any) => msg.y)) + 30;
        fragment.participants = [...new Set(fragmentMessages.flatMap((msg: any) => [msg.from, msg.to]))];
      } else {
        fragment.startY = 400 + fragments.indexOf(fragment) * 100;
        fragment.endY = fragment.startY + 80;
      }
    });

    fragments.sort((a, b) => a.startY - b.startY);
    const fragmentGap = 10;
    for (let i = 1; i < fragments.length; i++) {
      const prevFragment = fragments[i - 1], currentFragment = fragments[i];
      if (currentFragment.startY <= prevFragment.endY + fragmentGap) {
        const adjustment = (prevFragment.endY + fragmentGap) - currentFragment.startY;
        currentFragment.startY += adjustment; currentFragment.endY += adjustment;
        messages.filter(msg => currentFragment.sequenceIds && currentFragment.sequenceIds.includes(msg.sequenceId)).forEach(msg => { msg.y += adjustment; });
      }
    }

    return { type: DiagramType.SequenceDiagram, nodes: [], edges: [], metadata: { title: sequenceName, description: sequenceDescription, sourceFile: fileUri, lastModified: Date.now(), nodeCount: participants.size, edgeCount: messages.length }, sequenceDiagramData: { name: sequenceName, description: sequenceDescription, participants: Array.from(participants.values()), messages, fragments } };
  }

  private async transformToFMEADiagram(fileUri: string, _documentSymbols: DocumentSymbols): Promise<FMEADiagramData> {
    this.logger.info(`FMEA TRANSFORMER - Starting FMEA transformation for: ${fileUri}`);
    const content = await this._readFile(fileUri);
    const lines = content.split('\n');
    const failureSets: FMEAFailureSet[] = [];
    const propagationPaths: FMEAPropagationPath[] = [];
    const levels = new Set<string>();
    let currentFailureSet: Partial<FMEAFailureSet> | null = null;
    let currentFailureMode: Partial<FMEAFailureMode> | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('hdef failureset')) {
        const match = line.match(/hdef\s+failureset\s+(\w+)/);
        if (match) currentFailureSet = { id: match[1], name: match[1], level: 'system', failureModes: [], position: { x: 0, y: 0 }, rpnTotal: 0 };
      }
      if (line.startsWith('level ') && currentFailureSet) {
        const levelMatch = line.match(/level\s+(system|subsystem|module|part|solution|solutionelement|object|objectelement|buildingblock)/);
        if (levelMatch) { currentFailureSet.level = levelMatch[1] as any; levels.add(levelMatch[1]); }
      }
      if (line.startsWith('propagateto ref failureset') && currentFailureSet) {
        const propagateMatch = line.match(/propagateto\s+ref\s+failureset\s+(\w+)/);
        if (propagateMatch) currentFailureSet.propagateTo = propagateMatch[1];
      }
      if (line.startsWith('name ') && currentFailureSet) {
        const nameMatch = line.match(/name\s+"([^"]+)"/);
        if (nameMatch) currentFailureSet.name = nameMatch[1];
      }
      if (line.startsWith('def failuremode')) {
        const modeMatch = line.match(/def\s+failuremode\s+(\w+)/);
        if (modeMatch && currentFailureSet) currentFailureMode = { id: modeMatch[1], name: modeMatch[1], description: '', severity: 1, occurrence: 1, detectability: 1, rpn: 1, causedby: [], effects: [] };
      }
      if (currentFailureMode) {
        const severityMatch = line.match(/^severity\s+(\d+)/); if (severityMatch) currentFailureMode.severity = parseInt(severityMatch[1]);
        const occMatch = line.match(/^occurrence\s+(\d+)/); if (occMatch) currentFailureMode.occurrence = parseInt(occMatch[1]);
        const detMatch = line.match(/^detectability\s+(\d+)/); if (detMatch) currentFailureMode.detectability = parseInt(detMatch[1]);
        const slMatch = line.match(/^safetylevel\s+(ASIL-[A-D]|QM|SIL-[1-4])/); if (slMatch) currentFailureMode.safetylevel = slMatch[1];
        const fdtMatch = line.match(/^faultdetectiontime\s+([\d.]+)(us|ms|s|min|h)/); if (fdtMatch) currentFailureMode.faultDetectionTime = this.convertTimeToMilliseconds(parseFloat(fdtMatch[1]), fdtMatch[2]);
        const fttMatch = line.match(/^faulttolerancetime\s+([\d.]+)(us|ms|s|min|h)/); if (fttMatch) currentFailureMode.faultToleranceTime = this.convertTimeToMilliseconds(parseFloat(fttMatch[1]), fttMatch[2]);
        const pdMatch = line.match(/^propagationdelay\s+([\d.]+)(us|ms|s|min|h)/); if (pdMatch) currentFailureMode.propagationDelay = this.convertTimeToMilliseconds(parseFloat(pdMatch[1]), pdMatch[2]);
        const rtMatch = line.match(/^recoverytime\s+([\d.]+)(us|ms|s|min|h)/); if (rtMatch) currentFailureMode.recoveryTime = this.convertTimeToMilliseconds(parseFloat(rtMatch[1]), rtMatch[2]);
      }
      if (line === '' && currentFailureMode && currentFailureSet) {
        currentFailureMode.rpn = (currentFailureMode.severity || 1) * (currentFailureMode.occurrence || 1) * (currentFailureMode.detectability || 1);
        currentFailureSet.failureModes!.push(currentFailureMode as FMEAFailureMode);
        currentFailureSet.rpnTotal! += currentFailureMode.rpn;
        currentFailureMode = null;
      }
      if ((line === '' || i === lines.length - 1) && currentFailureSet && currentFailureSet.id) {
        failureSets.push(currentFailureSet as FMEAFailureSet);
        currentFailureSet = null;
      }
    }

    failureSets.forEach(failureSet => {
      if (failureSet.propagateTo) propagationPaths.push({ id: `${failureSet.id}_to_${failureSet.propagateTo}`, from: failureSet.id, to: failureSet.propagateTo, failureModes: failureSet.failureModes.map(fm => fm.id) });
    });

    const levelOrder = ['system', 'subsystem', 'module', 'part', 'solution', 'solutionelement', 'object', 'objectelement', 'buildingblock'];
    const levelGroups = new Map<string, FMEAFailureSet[]>();
    failureSets.forEach(fs => { if (!levelGroups.has(fs.level)) levelGroups.set(fs.level, []); levelGroups.get(fs.level)!.push(fs); });
    let xOffset = 100;
    levelOrder.forEach(level => {
      const group = levelGroups.get(level);
      if (group) { let yOffset = 100; group.forEach(fs => { fs.position = { x: xOffset, y: yOffset }; yOffset += 200; }); xOffset += 300; }
    });

    return { type: DiagramType.FMEADiagram, nodes: [], edges: [], metadata: { title: 'FMEA Hierarchy', description: 'Failure Mode and Effects Analysis with Threading', sourceFile: fileUri, lastModified: Date.now(), nodeCount: failureSets.length, edgeCount: propagationPaths.length }, failureSets, propagationPaths, levels: Array.from(levels).sort((a, b) => levelOrder.indexOf(a) - levelOrder.indexOf(b)) };
  }

  private async transformToImpactGraph(fileUri: string, _documentSymbols: DocumentSymbols, focusIdentifier?: string): Promise<ImpactGraphData> {
    this.logger.info(`IMPACT GRAPH TRANSFORMER - Starting impact graph transformation for: ${fileUri}`);
    const allSymbolsRaw = this.getAllSymbols();
    const excludedExtensions = ['spr', 'agt', 'ucd', 'seq'];
    const allSymbols = allSymbolsRaw.filter(symbol => !excludedExtensions.includes(symbol.fileUri.split('.').pop() || ''));

    let focusSymbol: SylangSymbol | undefined;
    if (focusIdentifier) focusSymbol = allSymbolsRaw.find(symbol => symbol.name === focusIdentifier);
    if (!focusSymbol) focusSymbol = allSymbolsRaw.find(symbol => symbol.fileUri === fileUri && symbol.type === 'header');

    if (!focusSymbol) {
      return { type: DiagramType.ImpactGraph, nodes: [], edges: [], focusNodeId: '', upstreamNodes: [], downstreamNodes: [], clusters: {}, fileGroups: {}, metadata: { title: 'Impact Graph - No Focus Symbol', description: 'No header symbol found in the selected file', sourceFile: fileUri, lastModified: Date.now(), nodeCount: 0, edgeCount: 0 } };
    }

    const impactNodes = new Map<string, GraphNode>();
    const impactEdges: GraphEdge[] = [];
    const upstreamNodes: string[] = [];
    const downstreamNodes: string[] = [];

    const focusNodeId = `${focusSymbol.fileUri}:${focusSymbol.name}`;
    impactNodes.set(focusNodeId, { id: focusNodeId, name: focusSymbol.name, type: focusSymbol.kind, position: { x: 0, y: 0 }, size: { width: 120, height: 60 }, properties: Object.fromEntries(focusSymbol.properties), parent: focusSymbol.parentSymbol, children: focusSymbol.children.map(child => child.name), configValue: focusSymbol.configValue, indentLevel: focusSymbol.indentLevel, symbolType: focusSymbol.type as 'hdef' | 'def', fileUri: focusSymbol.fileUri, connections: [] });

    this.buildUpstreamChain(focusSymbol, allSymbols, impactNodes, impactEdges, upstreamNodes);
    this.buildReverseReferences(focusSymbol, allSymbols, impactNodes, impactEdges, upstreamNodes);
    this.buildDownstreamTree(focusSymbol, allSymbols, impactNodes, impactEdges, downstreamNodes, new Set(), 0);

    const clusters = new Map<string, string[]>();
    const fileGroups = new Map<string, string[]>();
    impactNodes.forEach((node, nodeId) => {
      const fileExt = node.type;
      if (!clusters.has(fileExt)) clusters.set(fileExt, []);
      clusters.get(fileExt)!.push(nodeId);
      const filePath = nodeId.split(':')[0];
      if (!fileGroups.has(filePath)) fileGroups.set(filePath, []);
      fileGroups.get(filePath)!.push(nodeId);
    });

    const clustersObject: { [key: string]: string[] } = {};
    clusters.forEach((nodeIds, fileExt) => { clustersObject[fileExt] = nodeIds; });
    const fileGroupsObject: { [key: string]: string[] } = {};
    fileGroups.forEach((nodeIds, filePath) => { fileGroupsObject[filePath] = nodeIds; });

    return { type: DiagramType.ImpactGraph, nodes: Array.from(impactNodes.values()), edges: impactEdges, focusNodeId, upstreamNodes, downstreamNodes, clusters: clustersObject, fileGroups: fileGroupsObject, metadata: { title: `Impact Graph - ${focusSymbol.name}`, description: `Impact analysis for ${focusSymbol.kind}: ${focusSymbol.name}`, sourceFile: fileUri, lastModified: Date.now(), nodeCount: impactNodes.size, edgeCount: impactEdges.length } };
  }

  private buildUpstreamChain(currentSymbol: SylangSymbol, allSymbols: SylangSymbol[], impactNodes: Map<string, GraphNode>, impactEdges: GraphEdge[], upstreamNodes: string[]): void {
    if (!currentSymbol.parentSymbol) return;
    const parentSymbol = allSymbols.find(symbol => symbol.name === currentSymbol.parentSymbol && symbol.fileUri === currentSymbol.fileUri);
    if (!parentSymbol) return;
    const parentNodeId = `${parentSymbol.fileUri}:${parentSymbol.name}`;
    const currentNodeId = `${currentSymbol.fileUri}:${currentSymbol.name}`;
    if (!impactNodes.has(parentNodeId)) {
      impactNodes.set(parentNodeId, { id: parentNodeId, name: parentSymbol.name, type: parentSymbol.kind, position: { x: 0, y: 0 }, size: { width: 100, height: 50 }, properties: Object.fromEntries(parentSymbol.properties), parent: parentSymbol.parentSymbol, children: parentSymbol.children.map(child => child.name), configValue: parentSymbol.configValue, indentLevel: parentSymbol.indentLevel, symbolType: parentSymbol.type as 'hdef' | 'def', fileUri: parentSymbol.fileUri, connections: [] });
      upstreamNodes.push(parentNodeId);
    }
    impactEdges.push({ id: `${parentNodeId}->${currentNodeId}`, source: parentNodeId, target: currentNodeId, type: 'parentof', relationType: 'parentof', properties: { 'relationship': ['parentof'] } });
    this.buildUpstreamChain(parentSymbol, allSymbols, impactNodes, impactEdges, upstreamNodes);
  }

  private buildReverseReferences(focusSymbol: SylangSymbol, allSymbols: SylangSymbol[], impactNodes: Map<string, GraphNode>, impactEdges: GraphEdge[], upstreamNodes: string[]): void {
    const focusNodeId = `${focusSymbol.fileUri}:${focusSymbol.name}`;
    allSymbols.forEach(symbol => {
      if (symbol.name === focusSymbol.name) return;
      symbol.properties.forEach((values, propertyName) => {
        if (this.isReferenceProperty(propertyName)) {
          values.forEach(value => {
            let referencedNames: string[] = [];
            if (value.includes('ref ')) {
              const parts = value.split(/\s+/), refIndex = parts.indexOf('ref');
              if (refIndex !== -1 && refIndex + 2 < parts.length) referencedNames.push(parts[refIndex + 2]);
            } else if (value.includes(',')) {
              referencedNames = value.split(',').map(name => name.trim());
            } else {
              referencedNames.push(value);
            }
            if (referencedNames.includes(focusSymbol.name)) {
              const symbolNodeId = `${symbol.fileUri}:${symbol.name}`;
              if (!impactNodes.has(symbolNodeId)) {
                impactNodes.set(symbolNodeId, { id: symbolNodeId, name: symbol.name, type: symbol.kind, position: { x: 0, y: 0 }, size: { width: 100, height: 50 }, properties: Object.fromEntries(symbol.properties), parent: symbol.parentSymbol, children: symbol.children.map(child => child.name), configValue: symbol.configValue, indentLevel: symbol.indentLevel, symbolType: symbol.type as 'hdef' | 'def', fileUri: symbol.fileUri, connections: [] });
                upstreamNodes.push(symbolNodeId);
              }
              impactEdges.push({ id: `${symbolNodeId}-${propertyName}->${focusNodeId}`, source: symbolNodeId, target: focusNodeId, type: propertyName, relationType: propertyName, properties: { 'relationship': [propertyName] } });
            }
          });
        }
      });
    });
  }

  private buildDownstreamTree(currentSymbol: SylangSymbol, allSymbols: SylangSymbol[], impactNodes: Map<string, GraphNode>, impactEdges: GraphEdge[], downstreamNodes: string[], visited: Set<string>, depth: number): void {
    const currentNodeId = `${currentSymbol.fileUri}:${currentSymbol.name}`;
    if (visited.has(currentNodeId) || depth > 5) return;
    visited.add(currentNodeId);

    currentSymbol.children.forEach(childSymbol => {
      const childNodeId = `${childSymbol.fileUri}:${childSymbol.name}`;
      if (!impactNodes.has(childNodeId)) {
        impactNodes.set(childNodeId, { id: childNodeId, name: childSymbol.name, type: childSymbol.kind, position: { x: 0, y: 0 }, size: { width: 100, height: 50 }, properties: Object.fromEntries(childSymbol.properties), parent: childSymbol.parentSymbol, children: childSymbol.children.map(child => child.name), configValue: childSymbol.configValue, indentLevel: childSymbol.indentLevel, symbolType: childSymbol.type as 'hdef' | 'def', fileUri: childSymbol.fileUri, connections: [] });
        downstreamNodes.push(childNodeId);
      }
      impactEdges.push({ id: `${currentNodeId}->${childNodeId}`, source: currentNodeId, target: childNodeId, type: 'childof', relationType: 'childof', properties: { 'relationship': ['childof'] } });
      this.buildDownstreamTree(childSymbol, allSymbols, impactNodes, impactEdges, downstreamNodes, visited, depth + 1);
    });

    currentSymbol.properties.forEach((values, propertyName) => {
      if (this.isReferenceProperty(propertyName)) {
        values.forEach(value => {
          let referencedNames: string[] = [];
          if (value.includes('ref ')) { const parts = value.split(/\s+/); const refIndex = parts.indexOf('ref'); if (refIndex !== -1 && refIndex + 2 < parts.length) referencedNames.push(parts[refIndex + 2]); }
          else if (value.includes(',')) { referencedNames = value.split(',').map(name => name.trim()); }
          else { referencedNames.push(value); }
          referencedNames.forEach(referencedName => {
            const referencedSymbol = allSymbols.find(symbol => symbol.name === referencedName);
            if (referencedSymbol) {
              const referencedNodeId = `${referencedSymbol.fileUri}:${referencedSymbol.name}`;
              if (!impactNodes.has(referencedNodeId)) {
                impactNodes.set(referencedNodeId, { id: referencedNodeId, name: referencedSymbol.name, type: referencedSymbol.kind, position: { x: 0, y: 0 }, size: { width: 100, height: 50 }, properties: Object.fromEntries(referencedSymbol.properties), parent: referencedSymbol.parentSymbol, children: referencedSymbol.children.map(child => child.name), configValue: referencedSymbol.configValue, indentLevel: referencedSymbol.indentLevel, symbolType: referencedSymbol.type as 'hdef' | 'def', fileUri: referencedSymbol.fileUri, connections: [] });
                downstreamNodes.push(referencedNodeId);
              }
              impactEdges.push({ id: `${currentNodeId}-${propertyName}->${referencedNodeId}`, source: currentNodeId, target: referencedNodeId, type: propertyName, relationType: propertyName, properties: { 'relationship': [propertyName] } });
              this.buildDownstreamTree(referencedSymbol, allSymbols, impactNodes, impactEdges, downstreamNodes, visited, depth + 1);
            }
          });
        });
      }
    });
  }

  private convertTimeToMilliseconds(value: number, unit: string): number {
    switch (unit) {
      case 'us': return value / 1000;
      case 'ms': return value;
      case 's': return value * 1000;
      case 'min': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      default: return value;
    }
  }

  private async transformToStateMachineDiagram(fileUri: string, documentSymbols: DocumentSymbols): Promise<StateMachineDiagramData> {
    this.logger.info(`SMD TRANSFORMER - Transforming SMD file: ${fileUri}`);
    const fileContent = await this._readFile(fileUri);
    const states: SMDState[] = [];
    const transitions: SMDTransition[] = [];
    let stateMachineName = documentSymbols.headerSymbol?.name || 'Unknown State Machine';
    const lines = fileContent.split('\n');
    let currentState = '', currentTransition = '';
    const uniqueStates = new Map<string, SMDState>();
    const uniqueTransitions = new Map<string, SMDTransition>();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith('//')) continue;
      const tokens = trimmedLine.split(/\s+/);

      if (tokens[0] === 'def' && tokens[1] === 'state') {
        currentState = tokens[2]; currentTransition = '';
        if (!uniqueStates.has(currentState)) uniqueStates.set(currentState, { id: currentState, type: 'state', name: currentState, description: '', isInitial: false, isEnd: false, position: { x: 0, y: 0 }, size: { width: 120, height: 60 }, properties: {} });
      } else if (tokens[0] === 'def' && tokens[1] === 'transition') {
        currentTransition = tokens[2]; currentState = '';
        if (!uniqueTransitions.has(currentTransition)) uniqueTransitions.set(currentTransition, { id: currentTransition, type: 'transition', name: currentTransition, description: '', condition: '', fromStateId: '', toStateId: '', functionCall: '', source: '', target: '', properties: {} });
      } else if (currentState && tokens[0] === 'initialstate' && tokens[1] === 'true') {
        const state = uniqueStates.get(currentState); if (state) state.isInitial = true;
      } else if (currentState && tokens[0] === 'endstate' && tokens[1] === 'true') {
        const state = uniqueStates.get(currentState); if (state) state.isEnd = true;
      } else if (currentState && tokens[0] === 'name') {
        const state = uniqueStates.get(currentState); if (state) state.name = line.substring(line.indexOf('"') + 1, line.lastIndexOf('"'));
      } else if (currentState && tokens[0] === 'description') {
        const state = uniqueStates.get(currentState); if (state) state.description = line.substring(line.indexOf('"') + 1, line.lastIndexOf('"'));
      } else if (currentTransition && tokens[0] === 'from' && tokens[1] === 'ref' && tokens[2] === 'state') {
        const transition = uniqueTransitions.get(currentTransition); if (transition) { transition.fromStateId = tokens[3]; transition.source = tokens[3]; }
      } else if (currentTransition && tokens[0] === 'to' && tokens[1] === 'ref' && tokens[2] === 'state') {
        const transition = uniqueTransitions.get(currentTransition); if (transition) { transition.toStateId = tokens[3]; transition.target = tokens[3]; }
      } else if (currentTransition && tokens[0] === 'condition') {
        const transition = uniqueTransitions.get(currentTransition); if (transition) transition.condition = line.substring(line.indexOf('"') + 1, line.lastIndexOf('"'));
      } else if (currentTransition && tokens[0] === 'call' && tokens[1] === 'ref' && tokens[2] === 'function') {
        const transition = uniqueTransitions.get(currentTransition); if (transition) transition.functionCall = tokens[3];
      } else if (currentTransition && tokens[0] === 'name') {
        const transition = uniqueTransitions.get(currentTransition); if (transition) transition.name = line.substring(line.indexOf('"') + 1, line.lastIndexOf('"'));
      }
    }

    states.push(...uniqueStates.values());
    transitions.push(...uniqueTransitions.values());
    const stateMachineProperties: Record<string, string[]> = {};

    return { type: DiagramType.StateMachineDiagram, nodes: states, edges: transitions, states, transitions, stateMachineName, stateMachineProperties, metadata: { title: stateMachineName, sourceFile: fileUri, lastModified: Date.now(), nodeCount: states.length, edgeCount: transitions.length } };
  }

  private async createFunctionBlockFromSymbol(symbol: SylangSymbol, isMainFunctionset: boolean): Promise<SylangBlock> {
    const ports: SylangPort[] = [];
    const needsRefs = symbol.properties.get('needs') || [];
    const providesRefs = symbol.properties.get('provides') || [];

    for (const needRef of needsRefs) {
      const parsedNeeds = this.parseFunctionReference(needRef);
      for (const parsed of parsedNeeds) {
        let direction: 'in' | 'out' = 'in';
        let side: 'left' | 'right' | undefined;
        if (parsed.side === 'right') { direction = 'in'; side = 'right'; }
        else if (parsed.side === 'left') { direction = 'in'; side = 'left'; }
        ports.push({ id: `${symbol.name}_in_${parsed.name}`, name: parsed.name, direction, side, porttype: needRef.includes('operation') ? 'operation' : 'signal', x: 0, y: 0, width: 4, height: 12 });
      }
    }

    for (const offerRef of providesRefs) {
      const parsedOffers = this.parseFunctionReference(offerRef);
      for (const parsed of parsedOffers) {
        let direction: 'in' | 'out' = 'out';
        let side: 'left' | 'right' | undefined;
        if (parsed.side === 'left') { direction = 'out'; side = 'left'; }
        else if (parsed.side === 'right') { direction = 'out'; side = 'right'; }
        ports.push({ id: `${symbol.name}_out_${parsed.name}`, name: parsed.name, direction, side, porttype: offerRef.includes('operation') ? 'operation' : 'signal', x: 0, y: 0, width: 4, height: 12 });
      }
    }

    const nameWidth = Math.max(symbol.name.length * 8, 120);
    const portHeight = Math.max(ports.length * 20, 60);

    return { id: symbol.name, name: symbol.name, level: symbol.properties.get('level')?.[0] as any, functiontype: symbol.properties.get('functiontype')?.[0] as any, blocktype: symbol.properties.get('blocktype')?.[0] as any, x: isMainFunctionset ? 50 : 200, y: isMainFunctionset ? 50 : 150, width: nameWidth + 40, height: portHeight + 60, ports, fileUri: '' };
  }

  private parseFunctionReference(refString: string): Array<{ name: string; side?: 'left' | 'right' }> {
    const parsedItems: Array<{ name: string; side?: 'left' | 'right' }> = [];
    const trimmed = refString.trim();
    const match = trimmed.match(/^ref\s+(operation|signal)\s+(.+)$/);
    if (match) {
      const interfaceTokens = match[2].split(',').map(token => token.trim()).filter(token => token.length > 0);
      for (const token of interfaceTokens) {
        const lowerToken = token.toLowerCase();
        if (lowerToken.endsWith(' right')) parsedItems.push({ name: token.substring(0, token.length - 6).trim(), side: 'right' });
        else if (lowerToken.endsWith(' left')) parsedItems.push({ name: token.substring(0, token.length - 5).trim(), side: 'left' });
        else parsedItems.push({ name: token });
      }
    }
    return parsedItems;
  }

  private async createFunctionalConnections(functions: SylangSymbol[], blocks: SylangBlock[], connections: SylangConnection[]): Promise<void> {
    const mainBlock = blocks[0];
    const isFunctionsetLevel = mainBlock && blocks.length > 1 && functions.some(f => f.kind === 'functionset');
    const providers = new Map<string, { functionName: string; portId: string; type: string }>();

    if ((isFunctionsetLevel) && mainBlock) {
      const mainSymbol = functions.find(f => f.name === mainBlock.name);
      if (mainSymbol) {
        const mainOffersRefs = mainSymbol.properties.get('provides') || [];
        for (const offerRef of mainOffersRefs) {
          const parsedOffers = this.parseFunctionReference(offerRef);
          for (const parsed of parsedOffers) {
            providers.set(parsed.name, { functionName: mainBlock.name, portId: `${mainBlock.name}_out_${parsed.name}`, type: offerRef.includes('operation') ? 'operation' : 'signal' });
          }
        }
      }
    }

    for (const func of functions) {
      if (func.kind === 'function') {
        const providesRefs = func.properties.get('provides') || [];
        for (const offerRef of providesRefs) {
          const parsedOffers = this.parseFunctionReference(offerRef);
          for (const parsed of parsedOffers) {
            providers.set(parsed.name, { functionName: func.name, portId: `${func.name}_out_${parsed.name}`, type: offerRef.includes('operation') ? 'operation' : 'signal' });
          }
        }
      }
    }

    for (const func of functions) {
      if (func.kind === 'function') {
        const needsRefs = func.properties.get('needs') || [];
        for (const needRef of needsRefs) {
          const parsedNeeds = this.parseFunctionReference(needRef);
          for (const parsed of parsedNeeds) {
            const need = parsed.name;
            const provider = providers.get(need);
            if (provider) {
              connections.push({ id: `${provider.functionName}_to_${func.name}_${need}`, from: provider.portId, to: `${func.name}_in_${need}`, type: provider.type });
            }
          }
        }
      }
    }
  }

  private parseDecomposestoReferences(decomposestoRef: string): string[] {
    const functionNames: string[] = [];
    if (decomposestoRef.startsWith('ref function ')) {
      const functionsString = decomposestoRef.substring('ref function '.length);
      functionNames.push(...functionsString.split(',').map(name => name.trim()).filter(name => name.length > 0));
    }
    return functionNames;
  }

  private layoutFunctionalBlocks(blocks: SylangBlock[]): void {
    if (blocks.length <= 1) return;
    const containerBlock = blocks[0];
    const functionBlocks = blocks.slice(1);
    const cols = Math.ceil(Math.sqrt(functionBlocks.length));
    const blockSpacing = 200;
    const startX = containerBlock.x + 100, startY = containerBlock.y + 100;
    functionBlocks.forEach((block, index) => {
      block.x = startX + (index % cols) * blockSpacing;
      block.y = startY + Math.floor(index / cols) * blockSpacing;
    });
    const maxX = Math.max(...functionBlocks.map(b => b.x + b.width));
    const maxY = Math.max(...functionBlocks.map(b => b.y + b.height));
    containerBlock.width = Math.max(maxX - containerBlock.x + 100, 400);
    containerBlock.height = Math.max(maxY - containerBlock.y + 100, 300);
  }

  private async loadSavedPositionsForDecomposition(fileUri: string, decompositionType: 'functional' | 'feature', blocks: SylangBlock[], identifier?: string, connections?: SylangConnection[]): Promise<boolean> {
    // No-op in web — positions are auto-computed
    return false;
  }

  private resizeSystemBoundaryForLoadedPositions(blocks: SylangBlock[]): void {
    if (blocks.length <= 1) return;
    const systemBoundary = blocks[0];
    const internalBlocks = blocks.slice(1);
    const minX = Math.min(...internalBlocks.map(b => b.x));
    const minY = Math.min(...internalBlocks.map(b => b.y));
    const maxX = Math.max(...internalBlocks.map(b => b.x + b.width));
    const maxY = Math.max(...internalBlocks.map(b => b.y + b.height));
    const padding = 50;
    systemBoundary.x = minX - padding; systemBoundary.y = minY - padding;
    systemBoundary.width = Math.max((maxX - minX) + padding * 2, 400);
    systemBoundary.height = Math.max((maxY - minY) + padding * 2, 200);
  }

  private async transformToFaultTreeDiagram(fileUri: string, documentSymbols: DocumentSymbols): Promise<FaultTreeDiagramData> {
    this.logger.info(`FTA TRANSFORMER - Transforming FTA file: ${fileUri}`);
    const fileContent = await this._readFile(fileUri);
    const parsedData = this.ftaParser.parse(fileContent);

    const gates: FTAGateData[] = [];
    const events: FTAEventData[] = [];
    const connections: FTAConnectionData[] = [];
    let topEvent: FTAEventData | undefined;

    if (parsedData.topEventRef) {
      const topEventSymbol = this.symbolManager.resolveSymbol(parsedData.topEventRef, fileUri);
      const topEventName = topEventSymbol ? topEventSymbol.name : parsedData.topEventRef;
      const topEventWidth = Math.max(120, Math.min(topEventName.length * 8, 250));
      topEvent = { id: `event_${parsedData.topEventRef}`, name: topEventName, eventType: 'top', position: { x: 350, y: 50 }, width: topEventWidth, height: 50, failuremodeRef: parsedData.topEventRef };
      events.push(topEvent);
    }

    const processGate = (parsedGate: ParsedFTAGate, level: number): FTAGateData => {
      const gateId = `gate_${parsedGate.id}`;
      const gate: FTAGateData = { id: gateId, name: parsedGate.name, gateType: parsedGate.gateType, inputs: [], position: { x: 0, y: 0 }, width: 40, height: 40, description: parsedGate.description };
      gates.push(gate);

      parsedGate.inputs.forEach(input => {
        if (input.type === 'gate') {
          gate.inputs.push(`gate_${input.ref}`);
        } else if (input.type === 'failuremode') {
          const eventId = `event_${input.ref}`;
          if (!events.find(e => e.id === eventId)) {
            const failureSymbol = this.symbolManager.resolveSymbol(input.ref, fileUri);
            let eventType: 'basic' | 'undeveloped' = 'undeveloped';
            let failureRate: number | undefined, probability: number | undefined;
            let eventName = input.ref;
            if (failureSymbol && failureSymbol.kind === 'failuremode') {
              eventType = 'basic'; eventName = failureSymbol.name;
              const failureRateStr = failureSymbol.properties.get('failurerate')?.[0];
              if (failureRateStr) failureRate = parseFloat(failureRateStr);
              const probabilityStr = failureSymbol.properties.get('probability')?.[0];
              if (probabilityStr) probability = parseFloat(probabilityStr);
            }
            const eventWidth = Math.max(60, Math.min(eventName.length * 6, 180));
            events.push({ id: eventId, name: eventName, eventType, position: { x: 0, y: 0 }, width: eventWidth, height: 70, failuremodeRef: input.ref, failureRate, probability });
          }
          gate.inputs.push(eventId);
        }
      });

      if (parsedGate.output) {
        gate.output = parsedGate.output.type === 'gate' ? `gate_${parsedGate.output.ref}` : `event_${parsedGate.output.ref}`;
      }

      parsedGate.children.forEach(childGate => processGate(childGate, level + 1));
      return gate;
    };

    parsedData.gates.forEach(gate => processGate(gate, 0));

    gates.forEach(gate => {
      gate.inputs.forEach(inputId => connections.push({ id: `conn_${inputId}_to_${gate.id}`, source: inputId, target: gate.id }));
      if (gate.output) connections.push({ id: `conn_${gate.id}_to_${gate.output}`, source: gate.id, target: gate.output });
    });

    this.applyFTALayout(gates, events, connections, topEvent);

    return { type: DiagramType.FaultTreeAnalysis, faultTreeName: parsedData.name, topEvent, gates, events, connections, safetyLevel: parsedData.safetyLevel, nodes: [], edges: [], metadata: { title: parsedData.name, description: parsedData.description, sourceFile: fileUri, lastModified: Date.now(), nodeCount: gates.length + events.length, edgeCount: connections.length } };
  }

  private applyFTALayout(gates: FTAGateData[], events: FTAEventData[], connections: FTAConnectionData[], topEvent?: FTAEventData): void {
    const LEVEL_HEIGHT = 130, HALF_LEVEL_HEIGHT = 70, MIN_NODE_SPACING = 90, LEAF_WIDTH = 80, START_Y = 100;
    const childrenOf = new Map<string, string[]>();
    const parentsOf = new Map<string, string[]>();
    const gateIds = new Set(gates.map(g => g.id));
    const eventIds = new Set(events.map(e => e.id));
    const eventMap = new Map(events.map(e => [e.id, e]));
    const transferInEvents: FTAEventData[] = [];
    let transferCounter = 0;

    connections.forEach(conn => {
      if (!childrenOf.has(conn.target)) childrenOf.set(conn.target, []);
      if (!childrenOf.get(conn.target)!.includes(conn.source)) childrenOf.get(conn.target)!.push(conn.source);
      if (!parentsOf.has(conn.source)) parentsOf.set(conn.source, []);
      if (!parentsOf.get(conn.source)!.includes(conn.target)) parentsOf.get(conn.source)!.push(conn.target);
    });

    const sharedEventIds = new Set<string>();
    events.forEach(event => { if ((parentsOf.get(event.id) || []).length > 1) sharedEventIds.add(event.id); });

    const rootGateIds = gates.map(g => g.id).filter(gid => { const parents = parentsOf.get(gid) || []; return parents.length === 0 || parents.every(p => p.startsWith('event_')); });
    if (rootGateIds.length === 0 && gates.length > 0) rootGateIds.push(gates[0].id);

    const positionedNodes = new Map<string, { x: number; y: number }>();
    const visitedInTree = new Set<string>();
    const sharedEventFirstOccurrence = new Map<string, boolean>();
    const connectionRemaps = new Map<string, string>();

    interface TreeNode { id: string; children: TreeNode[]; width: number; x: number; y: number; isEvent: boolean; isTransferIn: boolean; }

    const buildTreeNode = (nodeId: string, level: number, isUnderGate: boolean, parentGateId?: string): TreeNode | null => {
      const isEvent = eventIds.has(nodeId), isGate = gateIds.has(nodeId);
      if (isEvent && sharedEventIds.has(nodeId)) {
        if (sharedEventFirstOccurrence.has(nodeId)) {
          transferCounter++;
          const transferInId = `${nodeId}_transfer_${transferCounter}`;
          const originalEvent = eventMap.get(nodeId)!;
          const yPos = START_Y + level * LEVEL_HEIGHT + (isUnderGate ? HALF_LEVEL_HEIGHT : 0);
          const transferInEvent: FTAEventData = { id: transferInId, name: originalEvent.name, eventType: 'transfer-in', position: { x: 0, y: yPos }, width: 60, height: 50, description: `Transfer from: ${originalEvent.name}`, failuremodeRef: originalEvent.failuremodeRef };
          transferInEvents.push(transferInEvent);
          if (parentGateId) connectionRemaps.set(`${nodeId}:${parentGateId}`, transferInId);
          return { id: transferInId, children: [], width: LEAF_WIDTH, x: 0, y: yPos, isEvent: true, isTransferIn: true };
        } else {
          sharedEventFirstOccurrence.set(nodeId, true);
        }
      }
      if (visitedInTree.has(nodeId)) return null;
      visitedInTree.add(nodeId);
      const children = childrenOf.get(nodeId) || [];
      const gateChildren = children.filter(cid => gateIds.has(cid));
      const eventChildren = children.filter(cid => eventIds.has(cid));
      const childNodes: TreeNode[] = [];
      gateChildren.forEach(childId => { const c = buildTreeNode(childId, level + 1, false, nodeId); if (c) childNodes.push(c); });
      eventChildren.forEach(childId => { const c = buildTreeNode(childId, level + 1, true, nodeId); if (c) childNodes.push(c); });
      let width = childNodes.length === 0 ? LEAF_WIDTH : childNodes.reduce((sum, c) => sum + c.width, 0) + (childNodes.length - 1) * MIN_NODE_SPACING;
      let yPos = START_Y + level * LEVEL_HEIGHT;
      if (isUnderGate && isEvent) yPos += HALF_LEVEL_HEIGHT;
      return { id: nodeId, children: childNodes, width: Math.max(width, LEAF_WIDTH), x: 0, y: yPos, isEvent, isTransferIn: false };
    };

    const positionTree = (node: TreeNode, leftBound: number): void => {
      node.x = leftBound + node.width / 2;
      let childLeft = leftBound;
      node.children.forEach(child => { positionTree(child, childLeft); childLeft += child.width + MIN_NODE_SPACING; });
      if (node.children.length > 0) node.x = (node.children[0].x + node.children[node.children.length - 1].x) / 2;
      positionedNodes.set(node.id, { x: node.x, y: node.y });
    };

    let currentX = 100;
    rootGateIds.forEach(rootId => {
      visitedInTree.clear(); sharedEventFirstOccurrence.clear();
      const tree = buildTreeNode(rootId, 0, false);
      if (tree) { positionTree(tree, currentX); currentX += tree.width + 200; }
    });

    if (transferInEvents.length > 0) events.push(...transferInEvents);
    connectionRemaps.forEach((newSourceId, remapKey) => {
      const [oldSourceId, targetId] = remapKey.split(':');
      connections.forEach(conn => { if (conn.source === oldSourceId && conn.target === targetId) conn.source = newSourceId; });
    });

    let unpositionedX = currentX + 100;
    events.forEach(event => {
      if (!positionedNodes.has(event.id)) {
        const parents = parentsOf.get(event.id) || [];
        if (parents.length > 0) {
          const parentPositions = parents.map(pid => positionedNodes.get(pid)).filter(p => p != null) as { x: number; y: number }[];
          if (parentPositions.length > 0) { positionedNodes.set(event.id, { x: parentPositions.reduce((sum, p) => sum + p.x, 0) / parentPositions.length, y: Math.max(...parentPositions.map(p => p.y)) + LEVEL_HEIGHT }); }
          else { positionedNodes.set(event.id, { x: unpositionedX, y: START_Y + LEVEL_HEIGHT }); unpositionedX += MIN_NODE_SPACING; }
        } else { positionedNodes.set(event.id, { x: unpositionedX, y: START_Y + LEVEL_HEIGHT }); unpositionedX += MIN_NODE_SPACING; }
      }
    });

    gates.forEach(gate => { const pos = positionedNodes.get(gate.id); if (pos) gate.position = { x: pos.x, y: pos.y }; });
    events.forEach(event => { const pos = positionedNodes.get(event.id); if (pos) event.position = { x: pos.x, y: pos.y }; });
  }
}
