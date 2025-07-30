/**
 * Canvas Sequence Renderer Performance Test
 * Run this in the browser console to test Canvas performance
 */

function testCanvasPerformance() {
    console.log('🧪 Starting Canvas Sequence Renderer Performance Test');
    
    // Test parameters
    const testSequences = [
        { name: 'Small (100bp)', sequence: 'ATCG'.repeat(25), length: 100 },
        { name: 'Medium (1kb)', sequence: 'ATCGATCGATCG'.repeat(84), length: 1008 },
        { name: 'Large (10kb)', sequence: 'ATCGATCGATCGATCG'.repeat(625), length: 10000 },
        { name: 'Very Large (50kb)', sequence: 'ATCGATCGATCGATCGATCG'.repeat(2500), length: 50000 }
    ];
    
    const results = [];
    
    testSequences.forEach(test => {
        console.log(`\n🔬 Testing ${test.name} sequence...`);
        
        // Create test container
        const container = document.createElement('div');
        container.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 800px;
            height: 50px;
            visibility: hidden;
        `;
        document.body.appendChild(container);
        
        // Test viewport
        const viewport = {
            start: 0,
            end: test.length,
            range: test.length
        };
        
        try {
            // Test Canvas renderer creation
            const startTime = performance.now();
            
            const canvasRenderer = new CanvasSequenceRenderer(container, test.sequence, viewport, {
                fontSize: 14,
                adaptiveHeight: true,
                minHeight: 20,
                maxHeight: 50
            });
            
            const creationTime = performance.now() - startTime;
            
            // Test drag performance (simulate 60 drag updates)
            const dragStartTime = performance.now();
            for (let i = 0; i < 60; i++) {
                canvasRenderer.applyDragTransform(i * 2, 0);
            }
            canvasRenderer.resetDragTransform();
            const dragTime = performance.now() - dragStartTime;
            
            // Test update performance
            const updateStartTime = performance.now();
            canvasRenderer.updateSequence(test.sequence.slice(0, test.length / 2), {
                start: 0,
                end: test.length / 2,
                range: test.length / 2
            });
            const updateTime = performance.now() - updateStartTime;
            
            // Get performance stats
            const stats = canvasRenderer.getPerformanceStats();
            
            // Cleanup
            canvasRenderer.destroy();
            document.body.removeChild(container);
            
            // Record results
            const result = {
                name: test.name,
                length: test.length,
                creationTime: creationTime.toFixed(2),
                dragTime: dragTime.toFixed(2),
                avgDragTime: (dragTime / 60).toFixed(3),
                updateTime: updateTime.toFixed(2),
                renderCount: stats.renderCount,
                lastRenderTime: stats.lastRenderTime.toFixed(2),
                avgTimePerBase: (stats.avgTimePerBase * 1000).toFixed(3) // Convert to microseconds
            };
            
            results.push(result);
            
            console.log(`✅ ${test.name} Results:`, result);
            
        } catch (error) {
            console.error(`❌ ${test.name} Failed:`, error);
            document.body.removeChild(container);
            
            results.push({
                name: test.name,
                length: test.length,
                error: error.message
            });
        }
    });
    
    // Display summary
    console.log('\n📊 Canvas Performance Test Summary:');
    console.table(results);
    
    // Performance analysis
    console.log('\n🎯 Performance Analysis:');
    const successfulTests = results.filter(r => !r.error);
    
    if (successfulTests.length > 0) {
        const avgCreationTime = successfulTests.reduce((sum, r) => sum + parseFloat(r.creationTime), 0) / successfulTests.length;
        const avgDragTime = successfulTests.reduce((sum, r) => sum + parseFloat(r.avgDragTime), 0) / successfulTests.length;
        
        console.log(`Average creation time: ${avgCreationTime.toFixed(2)}ms`);
        console.log(`Average drag time per frame: ${avgDragTime.toFixed(3)}ms`);
        console.log(`Estimated drag FPS: ${(1000 / avgDragTime).toFixed(1)} fps`);
        
        // Performance recommendations
        if (avgDragTime < 16.67) {
            console.log('🎉 Excellent performance! 60+ FPS achievable');
        } else if (avgDragTime < 33.33) {
            console.log('✅ Good performance! 30+ FPS achievable');
        } else {
            console.log('⚠️ Performance may be limited on slower devices');
        }
    }
    
    return results;
}

// Test DOM fallback performance for comparison
function testDOMFallbackPerformance() {
    console.log('\n🧪 Starting DOM Fallback Performance Test for Comparison');
    
    const testSequence = 'ATCGATCGATCGATCG'.repeat(625); // 10kb sequence
    const container = document.createElement('div');
    container.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 800px;
        height: 50px;
        visibility: hidden;
        white-space: nowrap;
        overflow: hidden;
    `;
    document.body.appendChild(container);
    
    // Create DOM elements like the old implementation
    const startTime = performance.now();
    
    for (let i = 0; i < testSequence.length; i++) {
        const baseElement = document.createElement('span');
        baseElement.className = `base-${testSequence[i].toLowerCase()} sequence-base-inline`;
        baseElement.textContent = testSequence[i];
        baseElement.style.cssText = `
            position: absolute;
            left: ${(i / testSequence.length) * 100}%;
            width: ${100 / testSequence.length}%;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            font-weight: bold;
            text-align: center;
        `;
        container.appendChild(baseElement);
    }
    
    const creationTime = performance.now() - startTime;
    
    // Test drag performance (simulate drag transforms)
    const dragStartTime = performance.now();
    for (let i = 0; i < 60; i++) {
        container.style.transform = `translateX(${i * 2}px)`;
    }
    container.style.transform = '';
    const dragTime = performance.now() - dragStartTime;
    
    document.body.removeChild(container);
    
    const domResult = {
        name: 'DOM Fallback (10kb)',
        creationTime: creationTime.toFixed(2),
        dragTime: dragTime.toFixed(2),
        avgDragTime: (dragTime / 60).toFixed(3),
        elementCount: testSequence.length
    };
    
    console.log('📊 DOM Fallback Results:', domResult);
    return domResult;
}

// Export functions for use
if (typeof window !== 'undefined') {
    window.testCanvasPerformance = testCanvasPerformance;
    window.testDOMFallbackPerformance = testDOMFallbackPerformance;
    
    console.log('🚀 Canvas performance test functions loaded!');
    console.log('Run testCanvasPerformance() to test Canvas rendering');
    console.log('Run testDOMFallbackPerformance() to test DOM fallback');
}