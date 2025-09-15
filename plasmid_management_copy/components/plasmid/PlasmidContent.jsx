const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const plasmidData = Object.fromEntries(formData.entries());

    if (currentPlasmid) {
        await updatePlasmid({ ...currentPlasmid, ...plasmidData });
    } else {
        await addPlasmid(plasmidData);
    }

    setIsModalOpen(false);
};

const handleBoxSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const boxData = Object.fromEntries(formData.entries());

    await addBox({
        ...boxData,
        slots: parseInt(boxData.slots),
        width: parseInt(boxData.width),
        height: parseInt(boxData.height),
        used: 0,
        layoutType: 'grid'
    });

    setIsNewBoxModalOpen(false);
};
