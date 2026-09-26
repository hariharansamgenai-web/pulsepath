import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Suppress console.error in tests unless explicitly testing for it
vi.spyOn(console, 'error').mockImplementation(() => undefined);
