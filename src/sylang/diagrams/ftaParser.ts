import type { SimpleLogger } from '../symbolManager/symbolManagerCore';

export interface ParsedFTAGate {
  id: string;
  name: string;
  gateType: 'and' | 'or' | 'xor' | 'inhibit' | 'pand' | 'voting';
  inputs: Array<{ type: 'gate' | 'failuremode'; ref: string }>;
  output?: { type: 'gate' | 'failuremode'; ref: string };
  description?: string;
  children: ParsedFTAGate[]; // Nested gates
  level: number; // Hierarchy depth
}

export interface ParsedFTAData {
  name: string;
  description?: string;
  owner?: string;
  tags?: string[];
  safetyLevel?: 'ASIL-A' | 'ASIL-B' | 'ASIL-C' | 'ASIL-D' | 'QM';
  topEventRef?: string; // Reference to failuremode
  gates: ParsedFTAGate[];
  allFailuremodeRefs: Set<string>; // All referenced failuremodes
}

export class FTAParser {
  private logger: SimpleLogger;

  constructor(logger: SimpleLogger) {
    this.logger = logger;
  }

  /**
   * Parse .fta file content into structured data
   */
  parseFTAFile(fileContent: string): ParsedFTAData {
    this.logger.info('FTA PARSER - Parsing FTA file');

    const lines = fileContent.split('\n');
    const result: ParsedFTAData = {
      name: 'Unknown FTA',
      gates: [],
      allFailuremodeRefs: new Set()
    };

    let currentLine = 0;

    // Parse header (hdef faulttree)
    while (currentLine < lines.length) {
      const line = lines[currentLine].trim();

      if (line.startsWith('hdef faulttree')) {
        const match = line.match(/hdef\s+faulttree\s+(\w+)/);
        if (match) {
          result.name = match[1];
        }
        currentLine++;
        break;
      }
      currentLine++;
    }

    // Parse header properties and gates
    while (currentLine < lines.length) {
      const line = lines[currentLine].trim();

      if (line.startsWith('name ')) {
        result.name = this.extractStringLiteral(line);
      } else if (line.startsWith('description ')) {
        result.description = this.extractStringLiteral(line);
      } else if (line.startsWith('owner ')) {
        result.owner = this.extractStringLiteral(line);
      } else if (line.startsWith('tags ')) {
        result.tags = this.extractTags(line);
      } else if (line.startsWith('safetylevel ')) {
        const match = line.match(/safetylevel\s+(ASIL-[A-D]|QM)/);
        if (match) {
          result.safetyLevel = match[1] as any;
        }
      } else if (line.startsWith('topevent ref failuremode')) {
        const match = line.match(/topevent\s+ref\s+failuremode\s+(\w+)/);
        if (match) {
          result.topEventRef = match[1];
          result.allFailuremodeRefs.add(match[1]);
        }
      } else if (line.startsWith('def gate') && this.getIndentLevel(lines[currentLine]) === 2) {
        // Parse top-level gate
        const gate = this.parseGateRecursive(lines, currentLine, 2, result);
        result.gates.push(gate);
        currentLine = gate.endLine;
        continue;
      }

      currentLine++;
    }

    this.logger.info(`FTA PARSER - Parsed ${result.gates.length} top-level gates, ${result.allFailuremodeRefs.size} failuremode refs`);

    return result;
  }

  /**
   * Parse gate recursively (handles nested gates)
   */
  private parseGateRecursive(lines: string[], startLine: number, expectedIndent: number, context: ParsedFTAData): ParsedFTAGate & { endLine: number } {
    const line = lines[startLine].trim();
    const match = line.match(/def\s+gate\s+(\w+)/);

    const gate: ParsedFTAGate & { endLine: number } = {
      id: match ? match[1] : `gate_${startLine}`,
      name: match ? match[1] : 'Unknown Gate',
      gateType: 'or', // Default
      inputs: [],
      children: [],
      level: expectedIndent / 2,
      endLine: startLine
    };

    let currentLine = startLine + 1;

    while (currentLine < lines.length) {
      const currentLineText = lines[currentLine];
      const trimmed = currentLineText.trim();
      const indent = this.getIndentLevel(currentLineText);

      // Exit if we're back to same or lower indent level
      if (trimmed && indent <= expectedIndent) {
        break;
      }

      // Parse gate properties
      if (indent === expectedIndent + 2) {
        if (trimmed.startsWith('name ')) {
          gate.name = this.extractStringLiteral(trimmed);
        } else if (trimmed.startsWith('description ')) {
          gate.description = this.extractStringLiteral(trimmed);
        } else if (trimmed.startsWith('gatetype ')) {
          const gateTypeMatch = trimmed.match(/gatetype\s+(and|or|xor|inhibit|pand|voting)/);
          if (gateTypeMatch) {
            gate.gateType = gateTypeMatch[1] as any;
          }
        } else if (trimmed.startsWith('input ref gate')) {
          // input ref gate gateA, gateB, gateC
          const refs = this.extractRefs(trimmed, 'gate');
          refs.forEach(ref => gate.inputs.push({ type: 'gate', ref }));
        } else if (trimmed.startsWith('input ref failuremode')) {
          // input ref failuremode FailureA, FailureB
          const refs = this.extractRefs(trimmed, 'failuremode');
          refs.forEach(ref => {
            gate.inputs.push({ type: 'failuremode', ref });
            context.allFailuremodeRefs.add(ref);
          });
        } else if (trimmed.startsWith('output ref gate')) {
          const outMatch = trimmed.match(/output\s+ref\s+gate\s+(\w+)/);
          if (outMatch) {
            gate.output = { type: 'gate', ref: outMatch[1] };
          }
        } else if (trimmed.startsWith('output ref failuremode')) {
          const outMatch = trimmed.match(/output\s+ref\s+failuremode\s+(\w+)/);
          if (outMatch) {
            gate.output = { type: 'failuremode', ref: outMatch[1] };
            context.allFailuremodeRefs.add(outMatch[1]);
          }
        } else if (trimmed.startsWith('def gate')) {
          // Nested gate
          const nestedGate = this.parseGateRecursive(lines, currentLine, expectedIndent + 2, context);
          gate.children.push(nestedGate);
          currentLine = nestedGate.endLine;
          continue;
        }
      }

      currentLine++;
    }

    gate.endLine = currentLine;
    return gate;
  }

  /**
   * Extract string literal from line (handles quotes)
   */
  private extractStringLiteral(line: string): string {
    const match = line.match(/"([^"]*)"/);
    return match ? match[1] : line.split(/\s+/).slice(1).join(' ');
  }

  /**
   * Extract tags from line
   */
  private extractTags(line: string): string[] {
    const afterTags = line.substring(line.indexOf('tags') + 4).trim();
    return afterTags.split(',').map(t => t.trim().replace(/"/g, ''));
  }

  /**
   * Extract multiple refs from input line
   * e.g., "input ref gate gateA, gateB, gateC"
   */
  private extractRefs(line: string, refType: 'gate' | 'failuremode'): string[] {
    const pattern = new RegExp(`input\\s+ref\\s+${refType}\\s+(.+)`);
    const match = line.match(pattern);
    if (!match) return [];

    return match[1].split(',').map(ref => ref.trim());
  }

  /**
   * Get indentation level (number of spaces)
   */
  private getIndentLevel(line: string): number {
    const match = line.match(/^(\s*)/);
    return match ? match[1].length : 0;
  }

  /**
   * Public wrapper that sets context (parses twice to capture failuremode refs in gate inputs)
   */
  parse(fileContent: string): ParsedFTAData {
    // First pass: collect all header-level failuremode refs
    const firstResult = this.parseFTAFile(fileContent);
    // Second pass with context (so nested gate refs are captured)
    const finalResult = this.parseFTAFile(fileContent);
    // Merge failuremode refs from both passes
    firstResult.allFailuremodeRefs.forEach(ref => finalResult.allFailuremodeRefs.add(ref));
    return finalResult;
  }
}
