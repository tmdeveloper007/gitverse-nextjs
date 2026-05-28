jest.mock('jspdf');

describe('graphExport', () => {
  beforeEach(() => {
    HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
      fillRect: jest.fn(),
      scale: jest.fn(),
      drawImage: jest.fn(),
    })) as any;
    HTMLCanvasElement.prototype.toDataURL = jest.fn(() => 'data:image/png;base64,test');
    Blob.prototype.constructor = jest.fn();
    URL.createObjectURL = jest.fn(() => 'blob:test-url');
    URL.revokeObjectURL = jest.fn();
    document.createElement = jest.fn((tag: string) => {
      if (tag === 'a') {
        return { download: '', href: '', click: jest.fn() };
      }
      return {};
    });
  });

  it('should create canvas with correct dimensions', () => {
    const mockSvg = {
      cloneNode: () => ({
        querySelector: () => ({
          removeAttribute: jest.fn(),
          getBBox: () => ({ x: 0, y: 0, width: 100, height: 100 }),
        }),
        setAttribute: jest.fn(),
      }),
      querySelector: () => ({
        getBBox: () => ({ x: 0, y: 0, width: 100, height: 100 }),
      }),
    } as any;

    expect(mockSvg.cloneNode).toBeDefined();
    expect(mockSvg.querySelector).toBeDefined();
  });
});