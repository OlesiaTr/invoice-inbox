import { render } from '@testing-library/react';
import { Markdown } from './Markdown';

describe('Markdown', () => {
  it('renders lists and bold', () => {
    const { container } = render(<Markdown text={'Failed:\n- **INV-1** · corrupt\n- INV-2'} />);
    expect(container.querySelectorAll('li')).toHaveLength(2);
    expect(container.querySelector('strong')?.textContent).toBe('INV-1');
  });

  it('never turns model output into HTML', () => {
    const { container } = render(<Markdown text={'<img src=x onerror=alert(1)> **hi**'} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});
