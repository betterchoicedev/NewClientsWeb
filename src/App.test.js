import { render, screen } from '@testing-library/react';
import App from './App';

// Smoke test: the site boots and the home page renders its main call to action.
test('renders the home page', async () => {
  render(<App />);
  expect((await screen.findAllByText(/BetterChoice/i)).length).toBeGreaterThan(0);
});
