module.exports = {
  preset: "jest-expo",
  testMatch: ["<rootDir>/src/**/*.test.ts", "<rootDir>/src/**/*.test.tsx"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.cjs"],
  modulePaths: ["<rootDir>/node_modules"],
  moduleNameMapper: {
    "^zod$": "<rootDir>/node_modules/zod",
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
};
