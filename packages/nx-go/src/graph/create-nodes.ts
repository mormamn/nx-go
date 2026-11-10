import {
  createNodesFromFiles,
  type CreateNodesContext,
  type CreateNodesResult,
  type CreateNodesResultArray,
  type CreateNodes,
  type ProjectConfiguration,
  type ProjectType,
} from '@nx/devkit';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { GO_MOD_FILE } from '../constants';
import type { NxGoPluginNodeOptions, NxGoPluginOptions } from '../type';
import { shouldCreateAirTarget, shouldUseReviveLinter } from '../utils';
import { findGoPackages } from './create-nodes/find-go-packages';
import {
  generateTargets,
  type DetectedTools,
} from './create-nodes/generate-targets';
import { hasMainPackage } from './create-nodes/has-main-package';

export const createNodes: CreateNodes<NxGoPluginOptions> = [
  `**/${GO_MOD_FILE}`,
  async (
    configFiles: readonly string[],
    options: NxGoPluginOptions | undefined,
    context: CreateNodesContext,
  ): Promise<CreateNodesResultArray> =>
    createNodesFromFiles(
      (configFile, options = {}, context) =>
        createNodesInternal(configFile, normalizeOptions(options), context),
      configFiles,
      options ?? {},
      context,
    ),
];

const normalizeOptions = (
  options: NxGoPluginOptions,
): NxGoPluginNodeOptions => ({
  projectGranularity: options.projectGranularity ?? 'module',
  buildTargetName: options.buildTargetName ?? 'build',
  serveTargetName: options.serveTargetName ?? 'serve',
  serveAirTargetName: options.serveAirTargetName ?? 'serve:air',
  testTargetName: options.testTargetName ?? 'test',
  lintTargetName: options.lintTargetName ?? 'lint',
  tidyTargetName: options.tidyTargetName ?? 'tidy',
  generateTargetName: options.generateTargetName ?? 'generate',
});

const createNodesInternal = async (
  configFilePath: string,
  options: NxGoPluginNodeOptions,
  context: CreateNodesContext,
): Promise<CreateNodesResult> => {
  const moduleRoot = dirname(configFilePath);
  const projectRoots =
    options.projectGranularity === 'package'
      ? findGoPackages(context.workspaceRoot, moduleRoot)
      : [moduleRoot];

  const projects: Record<string, ProjectConfiguration> = {};
  for (const projectRoot of projectRoots) {
    const project = createProject(projectRoot, options, context);
    if (project != null) {
      projects[projectRoot] = project;
    }
  }
  return { projects };
};

const createProject = (
  projectRoot: string,
  options: NxGoPluginNodeOptions,
  context: CreateNodesContext,
): ProjectConfiguration | null => {
  // Skip creating a project if this is the workspace root and it doesn't have a project.json file
  // This prevents unnecessary project creation in single-module repositories
  if (
    projectRoot === '.' &&
    !existsSync(join(context.workspaceRoot, 'project.json'))
  ) {
    return null;
  }

  // We assume that the project name is derived from the project root folder name
  // If needed, the user can still rename the project in the configuration file (project.json)
  const folderName =
    projectRoot === '.' ? undefined : projectRoot.split(/[/\\]/).pop();

  // Check if project is an application (has package main) or a library
  const isApplication = hasMainPackage(
    context.workspaceRoot,
    projectRoot,
    folderName,
  );
  const projectType: ProjectType = isApplication ? 'application' : 'library';

  const detectedTools: DetectedTools = {
    air:
      isApplication &&
      shouldCreateAirTarget(context.workspaceRoot, projectRoot),
    revive: shouldUseReviveLinter(context.workspaceRoot, projectRoot),
  };

  return {
    root: projectRoot,
    // Folder names are not unique among the packages of a module
    name:
      options.projectGranularity === 'package' && folderName
        ? projectRoot
        : folderName,
    projectType,
    targets: generateTargets(options, isApplication, detectedTools),
  };
};
