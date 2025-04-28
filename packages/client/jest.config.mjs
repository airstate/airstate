/** @type {import('ts-jest').JestConfigWithTsJest} */

const jestConfig = {
    extensionsToTreatAsEsm: ['.ts'],
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
    transform: {
        '^.+\\.m?[tj]sx?$': [
            'ts-jest',
            {
                useESM: true,
            },
        ],
    },
    testRegex: '^.+\\.test\\.mts$',
    moduleFileExtensions: ['ts', 'mts', 'js', 'mjs', 'cjs', 'jsx', 'tsx', 'json', 'node'],
}

export default jestConfig;