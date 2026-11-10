import { CreateNodesContext } from '@nx/devkit';
import { existsSync } from 'node:fs';
import { shouldCreateAirTarget, shouldUseReviveLinter } from '../utils';
import { createNodes } from './create-nodes';
import { findGoPackages } from './create-nodes/find-go-packages';
import { hasMainPackage } from './create-nodes/has-main-package';

jest.mock('./create-nodes/find-go-packages');
jest.mock('./create-nodes/has-main-package');
jest.mock('../utils');
jest.mock('node:fs');

const mockedFindGoPackages = jest.mocked(findGoPackages);
const mockedHasMainPackage = jest.mocked(hasMainPackage);
const mockedShouldCreateAirTarget = jest.mocked(shouldCreateAirTarget);
const mockedShouldUseReviveLinter = jest.mocked(shouldUseReviveLinter);
const mockedExistsSync = jest.mocked(existsSync);

describe('Create nodes', () => {
  let context: CreateNodesContext;

  beforeEach(() => {
    context = {
      workspaceRoot: '/workspace',
      nxJsonConfiguration: {},
    };
    jest.clearAllMocks();
    // Default: no air setup
    mockedShouldCreateAirTarget.mockReturnValue(false);
    // Default: no revive setup
    mockedShouldUseReviveLinter.mockReturnValue(false);
    // Default: project.json exists
    mockedExistsSync.mockReturnValue(true);
  });

  it('should compute all go.mod files', () => {
    expect(createNodes[0]).toEqual('**/go.mod');
  });

  describe('with inferred tasks', () => {
    it('should create inferred tasks for an application with package main', async () => {
      mockedHasMainPackage.mockReturnValue(true);

      const result = await createNodes[1](['apps/api/go.mod'], {}, context);

      expect(result).toMatchObject([
        [
          'apps/api/go.mod',
          {
            projects: {
              'apps/api': {
                name: 'api',
                root: 'apps/api',
                projectType: 'application',
                targets: {
                  build: {
                    executor: '@nx-go/nx-go:build',
                    cache: true,
                  },
                  serve: {
                    executor: '@nx-go/nx-go:serve',
                  },
                  test: {
                    executor: '@nx-go/nx-go:test',
                    cache: true,
                  },
                  lint: {
                    executor: '@nx-go/nx-go:lint',
                    cache: true,
                  },
                  tidy: {
                    executor: '@nx-go/nx-go:tidy',
                    cache: true,
                  },
                  generate: {
                    executor: '@nx-go/nx-go:generate',
                    cache: true,
                  },
                },
              },
            },
          },
        ],
      ]);
    });

    it('should create inferred tasks for a library without package main', async () => {
      mockedHasMainPackage.mockReturnValue(false);

      const result = await createNodes[1](['libs/utils/go.mod'], {}, context);

      expect(result).toMatchObject([
        [
          'libs/utils/go.mod',
          {
            projects: {
              'libs/utils': {
                name: 'utils',
                root: 'libs/utils',
                projectType: 'library',
                targets: {
                  test: {
                    executor: '@nx-go/nx-go:test',
                    cache: true,
                  },
                  lint: {
                    executor: '@nx-go/nx-go:lint',
                    cache: true,
                  },
                  tidy: {
                    executor: '@nx-go/nx-go:tidy',
                    cache: true,
                  },
                  generate: {
                    executor: '@nx-go/nx-go:generate',
                    cache: true,
                  },
                },
              },
            },
          },
        ],
      ]);

      const targets = result[0][1].projects?.['libs/utils'].targets;
      expect(targets).toBeDefined();
      expect(targets!.build).toBeUndefined();
      expect(targets!.serve).toBeUndefined();
    });

    it('should use custom target names from options', async () => {
      mockedHasMainPackage.mockReturnValue(true);

      const options = {
        buildTargetName: 'custom-build',
        testTargetName: 'custom-test',
        lintTargetName: 'custom-lint',
        tidyTargetName: 'custom-tidy',
        serveTargetName: 'custom-serve',
        generateTargetName: 'custom-generate',
      };
      const result = await createNodes[1](
        ['apps/myapp/go.mod'],
        options,
        context,
      );

      const targets = result[0][1].projects?.['apps/myapp'].targets;
      expect(targets).toBeDefined();
      expect(targets!['custom-build']).toBeDefined();
      expect(targets!['custom-serve']).toBeDefined();
      expect(targets!['custom-test']).toBeDefined();
      expect(targets!['custom-lint']).toBeDefined();
      expect(targets!['custom-tidy']).toBeDefined();
      expect(targets!['custom-generate']).toBeDefined();
    });

    it('should create project for go.mod at workspace root with project.json', async () => {
      const result = await createNodes[1](['./go.mod'], {}, context);
      const rootProject = result[0][1].projects?.['.'];
      expect(rootProject).toBeDefined();
      expect(rootProject!.root).toBe('.');
      expect(rootProject!.name).toBeUndefined();
    });

    it('should not create project for workspace root go.mod without project.json', async () => {
      mockedExistsSync.mockReturnValue(false);

      const result = await createNodes[1](['./go.mod'], {}, context);

      expect(result).toMatchObject([['./go.mod', { projects: {} }]]);
    });

    it('should use project name from last path segment', async () => {
      mockedHasMainPackage.mockReturnValue(false);

      const result = await createNodes[1](['apps/api/go.mod'], {}, context);

      expect(result[0][1].projects?.['apps/api'].name).toBe('api');
    });

    describe('Project granularity', () => {
      it('should create one project per go.mod file by default', async () => {
        mockedHasMainPackage.mockReturnValue(false);

        const result = await createNodes[1](['libs/utils/go.mod'], {}, context);

        expect(mockedFindGoPackages).not.toHaveBeenCalled();
        expect(Object.keys(result[0][1].projects ?? {})).toEqual([
          'libs/utils',
        ]);
      });

      it('should create one project per Go package', async () => {
        mockedExistsSync.mockReturnValue(false);
        mockedHasMainPackage.mockImplementation(
          (_, projectRoot) => projectRoot === 'apps/api',
        );
        mockedFindGoPackages.mockReturnValue(['apps/api', 'libs/a', 'libs/b']);

        const result = await createNodes[1](
          ['./go.mod'],
          { projectGranularity: 'package' },
          context,
        );

        expect(mockedFindGoPackages).toHaveBeenCalledWith('/workspace', '.');
        expect(result).toMatchObject([
          [
            './go.mod',
            {
              projects: {
                'apps/api': {
                  name: 'apps/api',
                  root: 'apps/api',
                  projectType: 'application',
                },
                'libs/a': {
                  name: 'libs/a',
                  root: 'libs/a',
                  projectType: 'library',
                },
                'libs/b': {
                  name: 'libs/b',
                  root: 'libs/b',
                  projectType: 'library',
                },
              },
            },
          ],
        ]);
      });

      it('should not include Go files of nested packages in inputs', async () => {
        mockedHasMainPackage.mockReturnValue(false);
        mockedFindGoPackages.mockReturnValue(['libs/a', 'libs/a/internal']);

        const result = await createNodes[1](
          ['./go.mod'],
          { projectGranularity: 'package' },
          context,
        );

        const targets = result[0][1].projects?.['libs/a'].targets;
        expect(targets).toBeDefined();
        expect(targets!['test']?.inputs).toContain('{projectRoot}/*.go');
        expect(targets!['test']?.inputs).not.toContain('{projectRoot}/**/*.go');
      });

      it('should not create project for workspace root package without project.json', async () => {
        mockedExistsSync.mockReturnValue(false);
        mockedFindGoPackages.mockReturnValue(['.', 'libs/a']);

        const result = await createNodes[1](
          ['./go.mod'],
          { projectGranularity: 'package' },
          context,
        );

        expect(Object.keys(result[0][1].projects ?? {})).toEqual(['libs/a']);
      });
    });

    describe('Air target', () => {
      it('should create air target with default name when config exists and air is available', async () => {
        mockedHasMainPackage.mockReturnValue(true);
        mockedShouldCreateAirTarget.mockReturnValue(true);

        const result = await createNodes[1](['apps/myapp/go.mod'], {}, context);

        const targets = result[0][1].projects?.['apps/myapp'].targets;
        expect(targets).toBeDefined();
        expect(targets!['serve:air']).toBeDefined();
        expect(targets!['serve:air']?.executor).toBe('@nx-go/nx-go:serve-air');
      });

      it('should use custom target name when specified', async () => {
        mockedHasMainPackage.mockReturnValue(true);
        mockedShouldCreateAirTarget.mockReturnValue(true);

        const options = {
          serveAirTargetName: 'air',
        };
        const result = await createNodes[1](
          ['apps/myapp/go.mod'],
          options,
          context,
        );

        const targets = result[0][1].projects?.['apps/myapp'].targets;
        expect(targets).toBeDefined();
        expect(targets!['air']).toBeDefined();
        expect(targets!['air']?.executor).toBe('@nx-go/nx-go:serve-air');
        expect(targets!['serve:air']).toBeUndefined();
      });

      it('should not create air target when air setup is not available', async () => {
        mockedHasMainPackage.mockReturnValue(true);
        mockedShouldCreateAirTarget.mockReturnValue(false);

        const result = await createNodes[1](['apps/myapp/go.mod'], {}, context);

        const targets = result[0][1].projects?.['apps/myapp'].targets;
        expect(targets).toBeDefined();
        expect(targets!['serve:air']).toBeUndefined();
      });

      it('should not create air target for libraries', async () => {
        mockedHasMainPackage.mockReturnValue(false);
        mockedShouldCreateAirTarget.mockReturnValue(true);

        const result = await createNodes[1](['libs/utils/go.mod'], {}, context);

        const targets = result[0][1].projects?.['libs/utils'].targets;
        expect(targets).toBeDefined();
        expect(targets!['serve:air']).toBeUndefined();
      });
    });

    describe('Revive linter', () => {
      it('should set revive linter option on lint target for an application', async () => {
        mockedHasMainPackage.mockReturnValue(true);
        mockedShouldUseReviveLinter.mockReturnValue(true);

        const result = await createNodes[1](['apps/myapp/go.mod'], {}, context);

        const targets = result[0][1].projects?.['apps/myapp'].targets;
        expect(targets).toBeDefined();
        expect(targets!['lint']?.inputs).toContain('{projectRoot}/revive.toml');
        expect(targets!['lint']?.options).toEqual({ linter: 'revive' });
      });

      it('should set revive linter option on lint target for a library', async () => {
        mockedHasMainPackage.mockReturnValue(false);
        mockedShouldUseReviveLinter.mockReturnValue(true);

        const result = await createNodes[1](['libs/utils/go.mod'], {}, context);

        const targets = result[0][1].projects?.['libs/utils'].targets;
        expect(targets).toBeDefined();
        expect(targets!['lint']?.inputs).toContain('{projectRoot}/revive.toml');
        expect(targets!['lint']?.options).toEqual({ linter: 'revive' });
      });

      it('should not set linter option when revive setup is not detected', async () => {
        mockedHasMainPackage.mockReturnValue(true);
        mockedShouldUseReviveLinter.mockReturnValue(false);

        const result = await createNodes[1](['apps/myapp/go.mod'], {}, context);

        const targets = result[0][1].projects?.['apps/myapp'].targets;
        expect(targets).toBeDefined();
        expect(targets!['lint']?.options).toBeUndefined();
      });
    });
  });
});
