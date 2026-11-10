import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { GO_MOD_FILE } from '../../constants';

const ignoredDirectories = ['vendor', 'testdata', 'node_modules'];

/**
 * Finds all directories of a Go module that contain a Go package.
 * Nested modules are not visited, as well as directories ignored by the Go tool.
 *
 * @param workspaceRoot - The root directory of the workspace
 * @param moduleRoot - The relative path to the module from the workspace root
 * @return string[] - The relative paths to the packages from the workspace root
 */
export const findGoPackages = (
  workspaceRoot: string,
  moduleRoot: string,
): string[] => {
  const packages: string[] = [];
  const entries = readdirSync(join(workspaceRoot, moduleRoot), {
    withFileTypes: true,
  });

  if (entries.some((entry) => entry.isFile() && entry.name.endsWith('.go'))) {
    packages.push(moduleRoot);
  }

  for (const entry of entries) {
    if (
      !entry.isDirectory() ||
      ignoredDirectories.includes(entry.name) ||
      /^[._]/.test(entry.name)
    ) {
      continue;
    }

    const directory =
      moduleRoot === '.' ? entry.name : `${moduleRoot}/${entry.name}`;
    if (!existsSync(join(workspaceRoot, directory, GO_MOD_FILE))) {
      packages.push(...findGoPackages(workspaceRoot, directory));
    }
  }

  return packages;
};
