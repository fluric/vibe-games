// This file runs before every Vitest test suite.
// It sets up React Testing Library's automatic cleanup after each test,
// so components are unmounted and don't bleed state into the next test.
import '@testing-library/react/pure';
