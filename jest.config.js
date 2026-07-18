/** Pruebas de dominio y servicios (TypeScript puro + módulos RN). */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  clearMocks: true,
};
