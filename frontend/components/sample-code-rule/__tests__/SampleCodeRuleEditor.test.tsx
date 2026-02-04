import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SampleCodeRuleEditor } from '../SampleCodeRuleEditor';
import { PreviewDisplay } from '../PreviewDisplay';
import { SAMPLE_CODE_ELEMENTS, SEPARATOR_OPTIONS } from '../types';
import type { CodeSlot } from '../types';

// Mock dnd-kit to avoid drag-and-drop complexity in tests
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DragOverlay: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  closestCenter: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
  useDroppable: vi.fn(() => ({ isOver: false, setNodeRef: vi.fn() })),
  useDraggable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    isDragging: false
  })),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  verticalListSortingStrategy: 'vertical',
  arrayMove: vi.fn((arr, from, to) => {
    const result = [...arr];
    const [removed] = result.splice(from, 1);
    result.splice(to, 0, removed);
    return result;
  }),
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  })),
}));

describe('SampleCodeRuleEditor', () => {
  const mockOnSlotsChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial render', () => {
    it('renders all available elements', () => {
      render(<SampleCodeRuleEditor slots={[]} onSlotsChange={mockOnSlotsChange} />);

      SAMPLE_CODE_ELEMENTS.forEach((element) => {
        expect(screen.getByText(element.label)).toBeInTheDocument();
      });
    });

    it('shows empty state when no slots configured', () => {
      render(<SampleCodeRuleEditor slots={[]} onSlotsChange={mockOnSlotsChange} />);

      expect(screen.getByText('拖拽下方要素到此处')).toBeInTheDocument();
    });
  });

  describe('with configured slots', () => {
    const slotsWithElements: CodeSlot[] = [
      { elementId: 'sponsor_code', separator: '-' },
      { elementId: 'subject_id', separator: '' },
    ];

    it('renders configured elements in drop zone', () => {
      render(<SampleCodeRuleEditor slots={slotsWithElements} onSlotsChange={mockOnSlotsChange} />);

      // Elements should be visible
      expect(screen.getAllByText('申办方项目编号').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('受试者编号').length).toBeGreaterThanOrEqual(1);
    });

    it('calls onSlotsChange when reset button is clicked', async () => {
      const user = userEvent.setup();
      render(<SampleCodeRuleEditor slots={slotsWithElements} onSlotsChange={mockOnSlotsChange} />);

      const resetButton = screen.getByText('重置');
      await user.click(resetButton);

      expect(mockOnSlotsChange).toHaveBeenCalledWith([]);
    });
  });

  describe('preview with project data', () => {
    it('shows sponsor code from project data', () => {
      const slots: CodeSlot[] = [{ elementId: 'sponsor_code', separator: '-' }];
      render(
        <SampleCodeRuleEditor
          slots={slots}
          onSlotsChange={mockOnSlotsChange}
          projectData={{ sponsor_project_code: 'PROJ-001', lab_project_code: 'LAB-001' }}
        />
      );

      expect(screen.getByText('PROJ-001')).toBeInTheDocument();
    });

    it('shows lab code from project data', () => {
      const slots: CodeSlot[] = [{ elementId: 'lab_code', separator: '' }];
      render(
        <SampleCodeRuleEditor
          slots={slots}
          onSlotsChange={mockOnSlotsChange}
          projectData={{ sponsor_project_code: 'PROJ-001', lab_project_code: 'LAB-001' }}
        />
      );

      expect(screen.getByText('LAB-001')).toBeInTheDocument();
    });
  });
});

describe('PreviewDisplay', () => {
  const elements = SAMPLE_CODE_ELEMENTS;

  it('shows placeholder when no slots', () => {
    render(<PreviewDisplay slots={[]} elements={elements} />);

    expect(screen.getByText(/将下方的编号要素拖拽至此处/i)).toBeInTheDocument();
  });

  it('displays element labels in preview', () => {
    const slots: CodeSlot[] = [
      { elementId: 'sponsor_code', separator: '-' },
      { elementId: 'subject_id', separator: '' },
    ];

    render(<PreviewDisplay slots={slots} elements={elements} />);

    // Should display element labels (may appear multiple times in preview and legend)
    expect(screen.getAllByText('申办方项目编号').length).toBeGreaterThanOrEqual(1);
  });

  it('uses project data for sponsor and lab codes', () => {
    const slots: CodeSlot[] = [
      { elementId: 'sponsor_code', separator: '-' },
      { elementId: 'lab_code', separator: '' },
    ];

    render(
      <PreviewDisplay
        slots={slots}
        elements={elements}
        projectData={{ sponsor_project_code: 'ABC-123', lab_project_code: 'XYZ-789' }}
      />
    );

    expect(screen.getAllByText('ABC-123').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('XYZ-789').length).toBeGreaterThanOrEqual(1);
  });
});

describe('types', () => {
  it('SAMPLE_CODE_ELEMENTS has correct elements', () => {
    expect(SAMPLE_CODE_ELEMENTS.length).toBe(9);
    expect(SAMPLE_CODE_ELEMENTS.map((e) => e.id)).toContain('sponsor_code');
    expect(SAMPLE_CODE_ELEMENTS.map((e) => e.id)).toContain('subject_id');
  });

  it('SEPARATOR_OPTIONS has correct options', () => {
    expect(SEPARATOR_OPTIONS).toHaveLength(3);
    expect(SEPARATOR_OPTIONS.map((o) => o.id)).toEqual(['', '-', '_']);
  });
});
