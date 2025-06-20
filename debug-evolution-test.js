/**
 * 调试脚本 - 测试进化界面显示
 */

// 添加调试按钮到页面
function addDebugButton() {
    console.log('🧪 Adding debug button...');
    
    const debugBtn = document.createElement('button');
    debugBtn.id = 'debugEvolutionBtn';
    debugBtn.innerHTML = '🧬 测试进化界面';
    debugBtn.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        background: #4a9eff;
        color: white;
        border: none;
        padding: 10px 15px;
        border-radius: 5px;
        cursor: pointer;
        font-size: 14px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    `;
    
    debugBtn.addEventListener('click', () => {
        console.log('🧪 Debug button clicked');
        testEvolutionInterface();
    });
    
    document.body.appendChild(debugBtn);
    console.log('✅ Debug button added');
}

// 测试进化界面
function testEvolutionInterface() {
    console.log('🧪 Testing evolution interface...');
    
    try {
        // 检查EvolutionInterfaceManager是否存在
        if (window.evolutionInterfaceManager) {
            console.log('✅ EvolutionInterfaceManager found');
            window.evolutionInterfaceManager.openEvolutionInterface();
        } else if (window.EvolutionInterfaceManager) {
            console.log('⚠️ Creating new EvolutionInterfaceManager instance');
            // 创建模拟管理器
            const mockEvolutionManager = {
                getEvolutionStats: () => ({
                    totalConversations: 5,
                    completedConversations: 3,
                    missingFunctions: 2,
                    generatedPlugins: 1,
                    successfulPlugins: 1
                }),
                evolutionData: {
                    conversations: [],
                    missingFunctions: [],
                    generatedPlugins: [],
                    evolutionHistory: []
                }
            };
            
            const mockConfigManager = {
                get: () => null,
                set: () => {}
            };
            
            const testManager = new window.EvolutionInterfaceManager(mockEvolutionManager, mockConfigManager);
            testManager.openEvolutionInterface();
        } else {
            console.error('❌ EvolutionInterfaceManager not available');
            createSimpleTestModal();
        }
    } catch (error) {
        console.error('❌ Test failed:', error);
        createSimpleTestModal();
    }
}

// 创建简单的测试模态框
function createSimpleTestModal() {
    console.log('🧪 Creating simple test modal...');
    
    // 移除现有的测试模态框
    const existing = document.getElementById('simpleTestModal');
    if (existing) {
        existing.remove();
    }
    
    const modal = document.createElement('div');
    modal.id = 'simpleTestModal';
    modal.style.cssText = `
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        background: rgba(0, 0, 0, 0.8) !important;
        z-index: 10000 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
    `;
    
    modal.innerHTML = `
        <div style="
            background: #1e1e1e !important;
            color: #e0e0e0 !important;
            padding: 30px !important;
            border-radius: 10px !important;
            max-width: 600px !important;
            width: 90% !important;
            box-shadow: 0 20px 40px rgba(0,0,0,0.5) !important;
        ">
            <h2 style="margin: 0 0 20px 0; color: #4a9eff;">🧬 进化系统测试</h2>
            <p>这是一个简单的测试模态框，用于验证模态框显示功能。</p>
            <p>如果您能看到这个界面，说明基本的模态框功能是正常的。</p>
            <div style="margin: 20px 0;">
                <strong>系统状态检查:</strong>
                <ul style="margin: 10px 0; padding-left: 20px;">
                    <li>EvolutionInterfaceManager: ${window.evolutionInterfaceManager ? '✅ 已加载' : '❌ 未找到'}</li>
                    <li>ConversationEvolutionManager: ${window.conversationEvolutionManager ? '✅ 已加载' : '❌ 未找到'}</li>
                    <li>EvolutionInterfaceManager类: ${window.EvolutionInterfaceManager ? '✅ 已加载' : '❌ 未找到'}</li>
                </ul>
            </div>
            <div style="text-align: center; margin-top: 30px;">
                <button onclick="document.getElementById('simpleTestModal').remove()" style="
                    background: #4a9eff;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    cursor: pointer;
                    margin-right: 10px;
                ">关闭</button>
                <button onclick="location.reload()" style="
                    background: #666;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    cursor: pointer;
                ">刷新页面</button>
            </div>
        </div>
    `;
    
    // 点击背景关闭
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    document.body.appendChild(modal);
    console.log('✅ Simple test modal created');
}

// 页面加载完成后添加调试按钮
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addDebugButton);
} else {
    addDebugButton();
}

console.log('🧪 Debug script loaded'); 