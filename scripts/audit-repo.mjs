#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const ROOT_DIR = process.cwd();
const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'out',
  'coverage',
]);
const LOCKFILES = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'];

const fsPromises = fs.promises;

async function findPackageJsons(dir) {
  const entries = await fsPromises.readdir(dir, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) {
        continue;
      }
      const nested = await findPackageJsons(entryPath);
      results.push(...nested);
      continue;
    }

    if (entry.isFile() && entry.name === 'package.json') {
      results.push(entryPath);
    }
  }

  return results;
}

function getDependencyVersion(pkg, name) {
  const sources = [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
  ];
  for (const source of sources) {
    const deps = pkg?.[source];
    if (deps && typeof deps === 'object' && deps[name]) {
      return deps[name];
    }
  }
  return null;
}

function parseMajor(versionSpec) {
  if (!versionSpec || typeof versionSpec !== 'string') {
    return null;
  }
  const match = versionSpec.match(/(\d+)(?:\.\d+)?/);
  if (!match) {
    return null;
  }
  return Number(match[1]);
}

function hasScript(scripts, name) {
  return typeof scripts?.[name] === 'string' && scripts[name].trim().length > 0;
}

function hasNextScript(scripts) {
  if (!scripts || typeof scripts !== 'object') {
    return false;
  }
  return Object.values(scripts).some(
    (value) => typeof value === 'string' && /\bnext\b/.test(value),
  );
}

function startUsesDist(startScript) {
  if (typeof startScript !== 'string') {
    return false;
  }
  return /dist[\\/]/.test(startScript);
}

function toDisplay(value) {
  return value ?? '-';
}

function relativePosix(filePath) {
  const relative = path.relative(ROOT_DIR, filePath) || 'package.json';
  return relative.split(path.sep).join('/');
}

function formatTable(rows, columns) {
  const data = rows.map((row) => columns.map((column) => column.get(row)));
  const widths = columns.map((column, index) => {
    const headerWidth = column.header.length;
    const contentWidth = Math.max(
      0,
      ...data.map((row) => row[index].length),
    );
    return Math.max(headerWidth, contentWidth);
  });

  const lines = [];
  lines.push(
    columns
      .map((column, index) => column.header.padEnd(widths[index]))
      .join('  '),
  );
  lines.push(widths.map((width) => '-'.repeat(width)).join('  '));

  for (const row of data) {
    lines.push(row.map((cell, index) => cell.padEnd(widths[index])).join('  '));
  }

  return lines.join('\n');
}

function collectLockfiles(dir) {
  const present = [];
  for (const lockfile of LOCKFILES) {
    if (fs.existsSync(path.join(dir, lockfile))) {
      present.push(lockfile);
    }
  }
  return present;
}

function detectIssues({
  parseError,
  versions,
  majors,
  scripts,
  startScript,
}) {
  const issues = [];

  if (parseError) {
    issues.push({
      code: 'json-parse',
      blocking: true,
      message: `Invalid JSON: ${parseError.message}`,
    });
    return issues;
  }

  const {
    react,
    reactDom,
    next,
    typesReact,
    typesReactDom,
  } = versions;
  const {
    reactMajor,
    reactDomMajor,
    nextMajor,
    typesReactMajor,
    typesReactDomMajor,
  } = majors;

  if (
    reactMajor !== null &&
    typesReactMajor !== null &&
    reactMajor !== typesReactMajor
  ) {
    issues.push({
      code: 'types-react-major',
      blocking: true,
      message: `react ${react} vs @types/react ${typesReact}`,
    });
  }

  if (
    reactDomMajor !== null &&
    typesReactDomMajor !== null &&
    reactDomMajor !== typesReactDomMajor
  ) {
    issues.push({
      code: 'types-react-dom-major',
      blocking: true,
      message: `react-dom ${reactDom} vs @types/react-dom ${typesReactDom}`,
    });
  }

  if (
    reactMajor !== null &&
    reactDomMajor !== null &&
    reactMajor !== reactDomMajor
  ) {
    issues.push({
      code: 'react-dom-major',
      blocking: true,
      message: `react ${react} vs react-dom ${reactDom}`,
    });
  }

  if (nextMajor !== null && reactMajor !== null) {
    const nextReactMismatch =
      (nextMajor >= 15 && reactMajor < 19) ||
      (nextMajor <= 14 && reactMajor >= 19);
    if (nextReactMismatch) {
      issues.push({
        code: 'next-react-major',
        blocking: true,
        message: `next ${next} vs react ${react}`,
      });
    }
  }

  if (startUsesDist(startScript) && !hasScript(scripts, 'build')) {
    issues.push({
      code: 'start-dist-no-build',
      blocking: true,
      message: 'start uses dist but build script is missing',
    });
  }

  return issues;
}

const packageJsonFiles = (await findPackageJsons(ROOT_DIR)).sort();
const rows = [];
const allIssues = [];

for (const filePath of packageJsonFiles) {
  const relativePath = relativePosix(filePath);
  const dir = path.dirname(filePath);

  let parsed = null;
  let parseError = null;

  try {
    const content = await fsPromises.readFile(filePath, 'utf8');
    parsed = JSON.parse(content);
  } catch (error) {
    parseError = error;
  }

  const scripts = parsed?.scripts ?? {};
  const dev = hasScript(scripts, 'dev');
  const build = hasScript(scripts, 'build');
  const start = hasScript(scripts, 'start');
  const startScript = scripts?.start ?? '';

  const next = parseError ? null : getDependencyVersion(parsed, 'next');
  const react = parseError ? null : getDependencyVersion(parsed, 'react');
  const reactDom = parseError ? null : getDependencyVersion(parsed, 'react-dom');
  const typesReact = parseError
    ? null
    : getDependencyVersion(parsed, '@types/react');
  const typesReactDom = parseError
    ? null
    : getDependencyVersion(parsed, '@types/react-dom');

  const nextMajor = parseMajor(next);
  const reactMajor = parseMajor(react);
  const reactDomMajor = parseMajor(reactDom);
  const typesReactMajor = parseMajor(typesReact);
  const typesReactDomMajor = parseMajor(typesReactDom);

  const appType =
    next || hasNextScript(scripts) ? 'next/dashboard' : 'node-service';

  const lockfiles = collectLockfiles(dir);
  const lockfileSummary = lockfiles.length > 0 ? lockfiles.join(',') : '-';

  const issues = detectIssues({
    parseError,
    versions: { next, react, reactDom, typesReact, typesReactDom },
    majors: {
      nextMajor,
      reactMajor,
      reactDomMajor,
      typesReactMajor,
      typesReactDomMajor,
    },
    scripts,
    startScript,
  });

  for (const issue of issues) {
    allIssues.push({ ...issue, packagePath: relativePath });
  }

  rows.push({
    packagePath: relativePath,
    appType,
    scripts: `${dev ? 'Y' : 'N'}/${build ? 'Y' : 'N'}/${start ? 'Y' : 'N'}`,
    next: toDisplay(next),
    react: toDisplay(react),
    reactDom: toDisplay(reactDom),
    typesReact: toDisplay(typesReact),
    typesReactDom: toDisplay(typesReactDom),
    lockfiles: lockfileSummary,
    issues: issues.length ? issues.map((issue) => issue.code).join(',') : '-',
  });
}

const table = formatTable(rows, [
  { header: 'Package', get: (row) => row.packagePath },
  { header: 'Type', get: (row) => row.appType },
  { header: 'Scripts D/B/S', get: (row) => row.scripts },
  { header: 'Next', get: (row) => row.next },
  { header: 'React', get: (row) => row.react },
  { header: 'ReactDOM', get: (row) => row.reactDom },
  { header: '@types/react', get: (row) => row.typesReact },
  { header: '@types/react-dom', get: (row) => row.typesReactDom },
  { header: 'Lockfiles', get: (row) => row.lockfiles },
  { header: 'Issues', get: (row) => row.issues },
]);

console.log(table);

const blockingIssues = allIssues.filter((issue) => issue.blocking);
if (blockingIssues.length > 0) {
  console.log('\nBlocking issues:');
  for (const issue of blockingIssues) {
    console.log(`- ${issue.packagePath}: ${issue.message}`);
  }
}

process.exitCode = blockingIssues.length > 0 ? 1 : 0;
