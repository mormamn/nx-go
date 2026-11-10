export const GO_MOD_FILE = 'go.mod';
export const GO_WORK_FILE = 'go.work';
export const GO_WORK_MINIMUM_VERSION = '1.18';
export const NX_PLUGIN_NAME = '@nx-go/nx-go';

/**
 * Contains all files that are common inputs for Go projects.
 * Used in multiple targets (build, test, lint, tidy) to ensure proper caching and invalidation.
 */
export const GO_PROJECT_INPUTS = [
  '{projectRoot}/go.mod',
  '{projectRoot}/go.sum',
  '{projectRoot}/**/*.go',
  '{workspaceRoot}/go.mod',
  '{workspaceRoot}/go.sum',
  '{workspaceRoot}/go.work',
  '{workspaceRoot}/go.work.sum',
];

/**
 * Same as GO_PROJECT_INPUTS, for projects made of a single Go package.
 * Go files of nested packages belong to other projects.
 */
export const GO_PACKAGE_INPUTS = GO_PROJECT_INPUTS.map((input) =>
  input === '{projectRoot}/**/*.go' ? '{projectRoot}/*.go' : input,
);
