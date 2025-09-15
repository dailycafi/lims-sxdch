export const generateMockBoxes = () => {
    return Array.from({ length: 3 }, (_, i) => ({
        id: `BOX00${i + 1}`,
        name: `质粒盒${i + 1}`,
        rows: 8,
        columns: 12,
        location: `冰箱A-0${i + 1}`,
        created_at: new Date().toISOString(),
        created_by: 1
    }));
};
