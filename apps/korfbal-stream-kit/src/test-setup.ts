import '@testing-library/jest-dom';
import {afterEach} from 'vitest';
import {clearToasts} from './lib/toast';

// Set VITE_API_BASE_URL for tests so URL objects work correctly
import.meta.env.VITE_API_BASE_URL = 'http://localhost/api';

// Toasts live outside the rendered tree (lib/toast.tsx): start every test without them
afterEach(() => clearToasts());
