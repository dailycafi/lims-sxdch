export const generateMockPlasmids = () => {
    return Array.from({ length: 15 }, (_, i) => ({
        id: `P${(i + 1).toString().padStart(7, '0')}`,
        name: `pLenti-CMV-${['GFP', 'RFP', 'YFP', 'BFP', 'CFP'][i % 5]}-${i + 1}`,
        box_id: `BOX00${i % 3 + 1}`,
        position: `${String.fromCharCode(65 + Math.floor(i / 10))}${(i % 10) + 1}`,
        vector: `pLenti${i % 3 + 1}`,
        target: `${['GFP', 'RFP', 'YFP', 'BFP', 'CFP'][i % 5]}-Target`,
        tagged_protein: ['GFP', 'FLAG', 'HA', 'His', 'GST'][i % 5],
        enzyme_sites: ['EcoRI/BamHI', 'HindIII/XhoI', 'NheI/NotI'][i % 3],
        source: ['自建', '分享', '购买'][i % 3],
        concentration: `${(i + 1) * 50} ng/μL`,
        status: ['normal', 'to_be_verified', 'depleted'][i % 3],
        created_at: new Date().toISOString(),
        created_by: 1
    }));
};
