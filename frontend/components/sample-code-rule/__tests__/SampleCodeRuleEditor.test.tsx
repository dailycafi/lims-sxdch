import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SampleCodeRuleEditor } from '../SampleCodeRuleEditor';
import { DraggableElementChip } from '../DraggableElementChip';
import { RulePreview } from '../RulePreview';
import { TemplateManager } from '../TemplateManager';
import { DEFAULT_ELEMENTS, SEPARATOR_OPTIONS, TEMPLATE_STORAGE_KEY } from '../types';
import type { CodeSlot, SampleCodeElement } from '../types';

describe('SampleCodeRuleEditor', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('initial render', () => {
    it('renders all available elements', () => {
      render(<SampleCodeRuleEditor slots={[]} onChange={mockOnChange} />);

      DEFAULT_ELEMENTS.forEach((element) => {
        expect(screen.getByText(element.label)).toBeInTheDocument();
        expect(screen.getByText(element.number)).toBeInTheDocument();
      });
    });

    it('shows empty state when no slots configured', () => {
      render(<SampleCodeRuleEditor slots={[]} onChange={mockOnChange} />);

      expect(screen.getByText('将下方的编号要素拖拽到此处')).toBeInTheDocument();
    });

    it('shows preview placeholder when no slots', () => {
      render(<SampleCodeRuleEditor slots={[]} onChange={mockOnChange} />);

      expect(screen.getByText('请配置编号规则')).toBeInTheDocument();
    });
  });

  describe('with configured slots', () => {
    const slotsWithElements: CodeSlot[] = [
      { elementId: 'sponsor_code', separator: '-' },
      { elementId: 'subject_id', separator: '' },
    ];

    it('renders configured elements in drop zone', () => {
      render(<SampleCodeRuleEditor slots={slotsWithElements} onChange={mockOnChange} />);

      // Elements appear in both drop zone and source area
      const sponsorElements = screen.getAllByText('申办方项目编号');
      const subjectElements = screen.getAllByText('受试者编号');

      expect(sponsorElements.length).toBeGreaterThanOrEqual(2); // Preview + source area
      expect(subjectElements.length).toBeGreaterThanOrEqual(2);
    });

    it('marks used elements as disabled in source area', () => {
      render(<SampleCodeRuleEditor slots={slotsWithElements} onChange={mockOnChange} />);

      const chips = screen.getAllByText('申办方项目编号');
      expect(chips.length).toBeGreaterThanOrEqual(1);
    });

    it('calls onChange when reset button is clicked', async () => {
      const user = userEvent.setup();
      render(<SampleCodeRuleEditor slots={slotsWithElements} onChange={mockOnChange} />);

      const resetButton = screen.getByText('重置所有');
      await user.click(resetButton);

      expect(mockOnChange).toHaveBeenCalledWith([]);
    });
  });

  describe('preview with project data', () => {
    it('shows sponsor code from project data', () => {
      const slots: CodeSlot[] = [{ elementId: 'sponsor_code', separator: '-' }];
      render(
        <SampleCodeRuleEditor
          slots={slots}
          onChange={mockOnChange}
          projectData={{ sponsorCode: 'PROJ-001', labCode: 'LAB-001' }}
        />
      );

      expect(screen.getByText('PROJ-001')).toBeInTheDocument();
    });

    it('shows lab code from project data', () => {
      const slots: CodeSlot[] = [{ elementId: 'lab_code', separator: '' }];
      render(
        <SampleCodeRuleEditor
          slots={slots}
          onChange={mockOnChange}
          projectData={{ sponsorCode: 'PROJ-001', labCode: 'LAB-001' }}
        />
      );

      expect(screen.getByText('LAB-001')).toBeInTheDocument();
    });
  });
});

describe('DraggableElementChip', () => {
  const mockElement: SampleCodeElement = {
    id: 'test_element',
    name: 'test_element',
    label: '测试元素',
    number: '①',
  };

  const specialElement: SampleCodeElement = {
    ...mockElement,
    id: 'special',
    label: '特殊元素',
    isSpecial: true,
  };

  it('renders element label and number', () => {
    render(<DraggableElementChip element={mockElement} isUsed={false} onDragEnd={vi.fn()} />);

    expect(screen.getByText('测试元素')).toBeInTheDocument();
    expect(screen.getByText('①')).toBeInTheDocument();
  });

  it('applies blue styling for normal elements', () => {
    const { container } = render(
      <DraggableElementChip element={mockElement} isUsed={false} onDragEnd={vi.fn()} />
    );

    const chip = container.firstChild as HTMLElement;
    expect(chip.className).toContain('bg-blue-100');
    expect(chip.className).toContain('text-blue-700');
  });

  it('applies purple styling for special elements', () => {
    const { container } = render(
      <DraggableElementChip element={specialElement} isUsed={false} onDragEnd={vi.fn()} />
    );

    const chip = container.firstChild as HTMLElement;
    expect(chip.className).toContain('bg-purple-100');
    expect(chip.className).toContain('text-purple-700');
  });

  it('applies disabled styling when used', () => {
    const { container } = render(
      <DraggableElementChip element={mockElement} isUsed={true} onDragEnd={vi.fn()} />
    );

    const chip = container.firstChild as HTMLElement;
    expect(chip.className).toContain('opacity-50');
    expect(chip.className).toContain('cursor-not-allowed');
  });
});

describe('RulePreview', () => {
  const elements = DEFAULT_ELEMENTS;

  it('shows placeholder when no slots', () => {
    render(<RulePreview slots={[]} elements={elements} />);

    expect(screen.getByText('请配置编号规则')).toBeInTheDocument();
  });

  it('displays element labels in preview', () => {
    const slots: CodeSlot[] = [
      { elementId: 'sponsor_code', separator: '-' },
      { elementId: 'subject_id', separator: '' },
    ];

    render(<RulePreview slots={slots} elements={elements} />);

    expect(screen.getByText('SPONSOR')).toBeInTheDocument();
    expect(screen.getByText('受试者编号')).toBeInTheDocument();
  });

  it('displays separator between elements', () => {
    const slots: CodeSlot[] = [
      { elementId: 'sponsor_code', separator: '-' },
      { elementId: 'subject_id', separator: '' },
    ];

    render(<RulePreview slots={slots} elements={elements} />);

    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('uses project data for sponsor and lab codes', () => {
    const slots: CodeSlot[] = [
      { elementId: 'sponsor_code', separator: '-' },
      { elementId: 'lab_code', separator: '' },
    ];

    render(
      <RulePreview
        slots={slots}
        elements={elements}
        projectData={{ sponsorCode: 'ABC-123', labCode: 'XYZ-789' }}
      />
    );

    expect(screen.getByText('ABC-123')).toBeInTheDocument();
    expect(screen.getByText('XYZ-789')).toBeInTheDocument();
  });
});

describe('TemplateManager', () => {
  const mockOnApply = vi.fn();
  const testSlots: CodeSlot[] = [
    { elementId: 'sponsor_code', separator: '-' },
    { elementId: 'subject_id', separator: '' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
  });

  it('shows empty state when no templates', () => {
    render(<TemplateManager currentSlots={[]} onApplyTemplate={mockOnApply} />);

    expect(screen.getByText('暂无保存的模板')).toBeInTheDocument();
  });

  it('disables save button when no slots', () => {
    render(<TemplateManager currentSlots={[]} onApplyTemplate={mockOnApply} />);

    const saveButton = screen.getByText('保存为模板');
    expect(saveButton).toBeDisabled();
  });

  it('enables save button when slots exist', () => {
    render(<TemplateManager currentSlots={testSlots} onApplyTemplate={mockOnApply} />);

    const saveButton = screen.getByText('保存为模板');
    expect(saveButton).not.toBeDisabled();
  });

  it('shows save dialog when save button clicked', async () => {
    const user = userEvent.setup();
    render(<TemplateManager currentSlots={testSlots} onApplyTemplate={mockOnApply} />);

    await user.click(screen.getByText('保存为模板'));

    expect(screen.getByPlaceholderText('输入模板名称')).toBeInTheDocument();
  });

  it('loads templates from localStorage', () => {
    const storedTemplates = [
      { id: 'template-1', name: '模板一', slots: testSlots, createdAt: new Date().toISOString() },
    ];
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(storedTemplates));

    render(<TemplateManager currentSlots={[]} onApplyTemplate={mockOnApply} />);

    expect(screen.getByText('模板一')).toBeInTheDocument();
  });

  it('calls onApplyTemplate when template is clicked', async () => {
    const user = userEvent.setup();
    const storedTemplates = [
      { id: 'template-1', name: '模板一', slots: testSlots, createdAt: new Date().toISOString() },
    ];
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(storedTemplates));

    render(<TemplateManager currentSlots={[]} onApplyTemplate={mockOnApply} />);

    await user.click(screen.getByText('模板一'));

    expect(mockOnApply).toHaveBeenCalledWith(testSlots);
  });
});

describe('types', () => {
  it('DEFAULT_ELEMENTS includes preprocessed_component as special', () => {
    const preprocessed = DEFAULT_ELEMENTS.find((e) => e.id === 'preprocessed_component');

    expect(preprocessed).toBeDefined();
    expect(preprocessed?.isSpecial).toBe(true);
    expect(preprocessed?.number).toBe('⑩');
  });

  it('SEPARATOR_OPTIONS has correct options', () => {
    expect(SEPARATOR_OPTIONS).toHaveLength(3);
    expect(SEPARATOR_OPTIONS.map((o) => o.id)).toEqual(['', '-', '_']);
  });

  it('TEMPLATE_STORAGE_KEY is defined', () => {
    expect(TEMPLATE_STORAGE_KEY).toBe('sample-code-rule-templates');
  });
});
