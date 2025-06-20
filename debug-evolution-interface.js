// 调试进化界面显示问题
console.log('🧪 Starting Evolution Interface Debug...');

function debugEvolutionInterface() {
    console.log('\n=== 进化界面调试 ===');
    
    // 1. 检查进化系统是否初始化
    console.log('1. 检查进化系统初始化状态:');
    console.log('- window.conversationEvolutionManager:', !!window.conversationEvolutionManager);
    console.log('- window.evolutionInterfaceManager:', !!window.evolutionInterfaceManager);
    console.log('- window.genomeBrowser:', !!window.genomeBrowser);
    
    if (window.genomeBrowser) {
        console.log('- genomeBrowser.conversationEvolutionManager:', !!window.genomeBrowser.conversationEvolutionManager);
        console.log('- genomeBrowser.evolutionInterfaceManager:', !!window.genomeBrowser.evolutionInterfaceManager);
    }
    
    // 2. 测试直接调用进化界面
    console.log('\n2. 尝试直接调用进化界面:');
    if (window.evolutionInterfaceManager) {
        try {
            console.log('📞 调用 window.evolutionInterfaceManager.openEvolutionInterface()...');
            window.evolutionInterfaceManager.openEvolutionInterface();
            
            // 检查模态框是否创建
            setTimeout(() => {
                const modal = document.getElementById('evolutionModal');
                console.log('📋 Modal element found:', !!modal);
                if (modal) {
                    console.log('📏 Modal style.display:', modal.style.display);
                    console.log('📐 Modal computed style display:', getComputedStyle(modal).display);
                    console.log('🌍 Modal in DOM:', document.body.contains(modal));
                    
                    const content = modal.querySelector('.evolution-modal-content');
                    if (content) {
                        console.log('📦 Content found:', !!content);
                        console.log('📏 Content dimensions:', content.getBoundingClientRect());
                    } else {
                        console.log('❌ Content not found in modal');
                    }
                } else {
                    console.log('❌ Modal not found in DOM');
                }
            }, 500);
            
        } catch (error) {
            console.error('❌ Error calling openEvolutionInterface:', error);
        }
    } else {
        console.log('❌ evolutionInterfaceManager not available');
    }
    
    // 3. 测试简化的模态框
    console.log('\n3. 创建简化测试模态框:');
    createTestModal();
}

function createTestModal() {
    try {
        // 移除现有的测试模态框
        const existing = document.getElementById('testEvolutionModal');
        if (existing) existing.remove();
        
        const testModal = document.createElement('div');
        testModal.id = 'testEvolutionModal';
        testModal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        testModal.innerHTML = `
            <div style="
                background: white;
                padding: 20px;
                border-radius: 8px;
                max-width: 500px;
                text-align: center;
                color: black;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            ">
                <h2>🧪 测试进化界面</h2>
                <p>如果你能看到这个消息，说明模态框显示功能正常。</p>
                <button onclick="document.getElementById('testEvolutionModal').remove()" 
                        style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    关闭测试
                </button>
                <hr style="margin: 15px 0;">
                <button onclick="forceCreateRealEvolutionInterface()" 
                        style="padding: 8px 16px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    强制创建真实进化界面
                </button>
            </div>
        `;
        
        document.body.appendChild(testModal);
        console.log('✅ Test modal created successfully');
        
    } catch (error) {
        console.error('❌ Error creating test modal:', error);
    }
}

function forceCreateRealEvolutionInterface() {
    console.log('🔧 强制创建真实进化界面...');
    
    try {
        // 关闭测试模态框
        const testModal = document.getElementById('testEvolutionModal');
        if (testModal) testModal.remove();
        
        // 强制创建进化界面
        if (window.evolutionInterfaceManager) {
            // 重置状态
            if (window.evolutionInterfaceManager.modal) {
                window.evolutionInterfaceManager.modal.remove();
                window.evolutionInterfaceManager.modal = null;
            }
            
            // 强制调用
            window.evolutionInterfaceManager.openEvolutionInterface();
            
            setTimeout(() => {
                const modal = document.getElementById('evolutionModal');
                if (modal) {
                    // 强制显示
                    modal.style.display = 'block';
                    modal.style.visibility = 'visible';
                    modal.style.opacity = '1';
                    
                    console.log('✅ 强制显示进化界面');
                    
                    // 添加关闭事件
                    modal.addEventListener('click', (e) => {
                        if (e.target === modal) {
                            modal.remove();
                        }
                    });
                    
                } else {
                    console.error('❌ 无法创建进化界面');
                }
            }, 100);
            
        } else {
            console.error('❌ evolutionInterfaceManager 不可用');
        }
        
    } catch (error) {
        console.error('❌ 强制创建失败:', error);
    }
}

// 使函数全局可用
window.debugEvolutionInterface = debugEvolutionInterface;
window.forceCreateRealEvolutionInterface = forceCreateRealEvolutionInterface;

// 自动运行调试
setTimeout(debugEvolutionInterface, 2000); 