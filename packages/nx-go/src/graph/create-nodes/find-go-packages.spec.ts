import { existsSync, readdirSync, type Dirent } from 'node:fs';
import { findGoPackages } from './find-go-packages';

jest.mock('node:fs');

const mockedExistsSync = jest.mocked(existsSync);
const mockedReaddirSync = jest.mocked(readdirSync);

const file = (name: string) =>
  ({ name, isFile: () => true, isDirectory: () => false }) as Dirent;
const directory = (name: string) =>
  ({ name, isFile: () => false, isDirectory: () => true }) as Dirent;

describe('findGoPackages', () => {
  const mockDirectories = (directories: Record<string, Dirent[]>) =>
    mockedReaddirSync.mockImplementation(
      ((path: string) => directories[path] ?? []) as never,
    );

  beforeEach(() => mockedExistsSync.mockReturnValue(false));
  afterEach(() => jest.clearAllMocks());

  it('should find directories containing Go files', () => {
    mockDirectories({
      '/workspace': [file('go.mod'), directory('apps'), directory('libs')],
      '/workspace/apps': [directory('api')],
      '/workspace/apps/api': [file('main.go')],
      '/workspace/libs': [directory('a'), directory('b'), directory('docs')],
      '/workspace/libs/a': [file('a.go'), file('a_test.go')],
      '/workspace/libs/b': [file('b.go'), directory('internal')],
      '/workspace/libs/b/internal': [file('internal.go')],
      '/workspace/libs/docs': [file('README.md')],
    });

    expect(findGoPackages('/workspace', '.')).toEqual([
      'apps/api',
      'libs/a',
      'libs/b',
      'libs/b/internal',
    ]);
  });

  it('should find the package at the module root', () => {
    mockDirectories({
      '/workspace/libs/a': [file('go.mod'), file('a.go'), directory('sub')],
      '/workspace/libs/a/sub': [file('sub.go')],
    });

    expect(findGoPackages('/workspace', 'libs/a')).toEqual([
      'libs/a',
      'libs/a/sub',
    ]);
  });

  it.each`
    name
    ${'vendor'}
    ${'testdata'}
    ${'node_modules'}
    ${'.git'}
    ${'_tools'}
  `('should ignore the $name directory', ({ name }) => {
    mockDirectories({
      '/workspace': [directory(name), directory('libs')],
      [`/workspace/${name}`]: [file('ignored.go')],
      '/workspace/libs': [file('libs.go')],
    });

    expect(findGoPackages('/workspace', '.')).toEqual(['libs']);
  });

  it('should not go into nested modules', () => {
    mockDirectories({
      '/workspace': [file('root.go'), directory('nested')],
      '/workspace/nested': [file('go.mod'), file('nested.go')],
    });
    mockedExistsSync.mockImplementation(
      (path) => path === '/workspace/nested/go.mod',
    );

    expect(findGoPackages('/workspace', '.')).toEqual(['.']);
  });
});
