/**
 * Benchmark Report Generator - Generate comprehensive reports from benchmark results
 */
class BenchmarkReportGenerator {
    constructor() {
        this.reportTemplates = {
            executive: 'executive_summary',
            detailed: 'detailed_analysis',
            technical: 'technical_deep_dive',
            comparative: 'comparative_analysis'
        };
    }

    /**
     * Generate comprehensive report
     */
    generateReport(benchmarkResults, options = {}) {
        const reportType = options.type || 'detailed';
        const includeCharts = options.includeCharts !== false;
        const includeRawData = options.includeRawData === true;
        const includeLLMInteractions = options.includeLLMInteractions !== false; // Default to true
        
        const report = {
            metadata: this.generateMetadata(benchmarkResults, options),
            executiveSummary: this.generateExecutiveSummary(benchmarkResults),
            detailedAnalysis: this.generateDetailedAnalysis(benchmarkResults),
            statisticalAnalysis: this.generateStatisticalAnalysis(benchmarkResults),
            performanceAnalysis: this.generatePerformanceAnalysis(benchmarkResults),
            errorAnalysis: this.generateErrorAnalysis(benchmarkResults),
            recommendations: this.generateRecommendations(benchmarkResults),
            appendices: this.generateAppendices(benchmarkResults, includeRawData)
        };

        // CRITICAL ENHANCEMENT: Add comprehensive LLM interaction analysis
        if (includeLLMInteractions) {
            report.llmInteractionAnalysis = this.generateLLMInteractionAnalysis(benchmarkResults);
            report.conversationFlows = this.generateConversationFlows(benchmarkResults);
            report.promptAnalysis = this.generatePromptAnalysis(benchmarkResults);
            report.responsePatterns = this.generateResponsePatterns(benchmarkResults);
        }

        if (includeCharts) {
            report.charts = this.generateChartData(benchmarkResults);
        }

        return report;
    }

    /**
     * Generate report metadata
     */
    generateMetadata(benchmarkResults, options) {
        return {
            reportTitle: 'LLM Instruction Following Benchmark Report',
            generatedAt: new Date().toISOString(),
            generatedBy: 'Genome AI Studio Benchmark Framework',
            version: '1.0.0',
            benchmarkSession: {
                startTime: new Date(benchmarkResults.startTime).toISOString(),
                endTime: new Date(benchmarkResults.endTime).toISOString(),
                duration: this.formatDuration(benchmarkResults.duration),
                totalTests: benchmarkResults.overallStats.totalTests,
                totalSuites: benchmarkResults.overallStats.totalSuites
            },
            options: options,
            systemInfo: this.getSystemInfo()
        };
    }

    /**
     * Generate executive summary
     */
    generateExecutiveSummary(benchmarkResults) {
        const stats = benchmarkResults.overallStats;
        
        return {
            keyFindings: [
                `Overall success rate: ${stats.overallSuccessRate.toFixed(1)}%`,
                `${stats.passedTests}/${stats.totalTests} tests passed`,
                `Average score: ${stats.scoreStats.percentage.mean.toFixed(1)}%`,
                `Total execution time: ${this.formatDuration(benchmarkResults.duration)}`,
                `Error rate: ${stats.errorAnalysis.errorRate.toFixed(1)}%`
            ],
            performanceHighlights: this.extractPerformanceHighlights(stats),
            qualityAssessment: this.assessOverallQuality(stats),
            criticalIssues: this.identifyCriticalIssues(stats),
            recommendations: this.getTopRecommendations(stats)
        };
    }

    /**
     * Generate detailed analysis
     */
    generateDetailedAnalysis(benchmarkResults) {
        const analysis = {
            testSuiteBreakdown: [],
            categoryAnalysis: {},
            trendAnalysis: benchmarkResults.overallStats.trendAnalysis,
            correlationFindings: benchmarkResults.overallStats.correlationAnalysis.insights
        };

        // Analyze each test suite
        for (const suiteResult of benchmarkResults.testSuiteResults) {
            analysis.testSuiteBreakdown.push({
                suiteName: suiteResult.suiteName,
                suiteId: suiteResult.suiteId,
                summary: {
                    totalTests: suiteResult.stats.totalTests,
                    successRate: suiteResult.stats.successRate,
                    averageScore: suiteResult.stats.scoreStats.percentage.mean,
                    averageDuration: suiteResult.stats.performanceStats.duration.mean
                },
                strengths: this.identifyStrengths(suiteResult),
                weaknesses: this.identifyWeaknesses(suiteResult),
                insights: this.generateSuiteInsights(suiteResult)
            });
        }

        // Category-based analysis
        analysis.categoryAnalysis = this.analyzeByCategoriesfunction(benchmarkResults);

        return analysis;
    }

    /**
     * Generate statistical analysis
     */
    generateStatisticalAnalysis(benchmarkResults) {
        const stats = benchmarkResults.overallStats;
        
        return {
            descriptiveStatistics: {
                scoreDistribution: stats.scoreStats,
                performanceDistribution: stats.performanceStats,
                reliabilityMetrics: stats.reliabilityMetrics
            },
            inferentialStatistics: {
                confidenceIntervals: this.calculateConfidenceIntervals(stats),
                significanceTests: this.performSignificanceTests(benchmarkResults),
                effectSizeAnalysis: this.calculateEffectSizes(benchmarkResults)
            },
            correlationAnalysis: {
                strongCorrelations: stats.correlationAnalysis.strongCorrelations,
                insights: stats.correlationAnalysis.insights,
                predictiveModels: this.buildPredictiveModels(benchmarkResults)
            },
            complexityAnalysis: stats.complexityAnalysis
        };
    }

    /**
     * Generate performance analysis
     */
    generatePerformanceAnalysis(benchmarkResults) {
        const stats = benchmarkResults.overallStats;
        
        return {
            responseTimeAnalysis: {
                distribution: stats.performanceStats.responseTime,
                percentiles: this.calculateResponseTimePercentiles(benchmarkResults),
                outliers: this.identifyPerformanceOutliers(benchmarkResults)
            },
            throughputAnalysis: {
                testsPerSecond: stats.performanceStats.throughput.testsPerSecond,
                bottlenecks: this.identifyBottlenecks(benchmarkResults),
                scalabilityInsights: this.analyzeScalability(benchmarkResults)
            },
            resourceUtilization: {
                tokenUsage: stats.performanceStats.tokenUsage,
                memoryUsage: this.estimateMemoryUsage(benchmarkResults),
                efficiency: stats.qualityMetrics.efficiency
            },
            performanceTrends: stats.trendAnalysis.performance
        };
    }

    /**
     * Generate error analysis
     */
    generateErrorAnalysis(benchmarkResults) {
        const errorStats = benchmarkResults.overallStats.errorAnalysis;
        
        return {
            errorOverview: {
                totalErrors: errorStats.totalErrors,
                errorRate: errorStats.errorRate,
                errorCategories: errorStats.errorCategories,
                mostCommonError: errorStats.mostCommonError
            },
            errorPatterns: {
                patterns: errorStats.errorPatterns,
                trends: errorStats.errorTrends,
                rootCauseAnalysis: this.performRootCauseAnalysis(benchmarkResults)
            },
            errorImpact: {
                severityAssessment: this.assessErrorSeverity(benchmarkResults),
                recoveryAnalysis: this.analyzeErrorRecovery(benchmarkResults),
                preventionStrategies: this.suggestPreventionStrategies(errorStats)
            },
            warningAnalysis: {
                totalWarnings: errorStats.totalWarnings,
                warningRate: errorStats.warningRate,
                warningPatterns: this.analyzeWarningPatterns(benchmarkResults)
            }
        };
    }

    /**
     * Generate recommendations
     */
    generateRecommendations(benchmarkResults) {
        const stats = benchmarkResults.overallStats;
        const recommendations = {
            immediate: [],
            shortTerm: [],
            longTerm: [],
            technical: [],
            process: []
        };

        // Immediate recommendations
        if (stats.overallSuccessRate < 70) {
            recommendations.immediate.push({
                priority: 'high',
                category: 'quality',
                title: 'Improve Instruction Following Accuracy',
                description: 'Success rate is below acceptable threshold (70%)',
                action: 'Review and refine prompt engineering strategies'
            });
        }

        if (stats.errorAnalysis.errorRate > 10) {
            recommendations.immediate.push({
                priority: 'high',
                category: 'stability',
                title: 'Reduce Error Rate',
                description: 'Error rate exceeds acceptable threshold (10%)',
                action: 'Implement better error handling and input validation'
            });
        }

        // Short-term recommendations
        if (stats.performanceStats.duration.mean > 10000) {
            recommendations.shortTerm.push({
                priority: 'medium',
                category: 'performance',
                title: 'Optimize Response Time',
                description: 'Average response time is above optimal range',
                action: 'Investigate and optimize slow-performing operations'
            });
        }

        // Long-term recommendations
        if (stats.reliabilityMetrics.scoreReliability < 80) {
            recommendations.longTerm.push({
                priority: 'medium',
                category: 'consistency',
                title: 'Improve Score Consistency',
                description: 'Score reliability is below target',
                action: 'Implement consistency training and validation'
            });
        }

        // Technical recommendations
        recommendations.technical = this.generateTechnicalRecommendations(stats);
        
        // Process recommendations
        recommendations.process = this.generateProcessRecommendations(benchmarkResults);

        return recommendations;
    }

    /**
     * Generate appendices
     */
    generateAppendices(benchmarkResults, includeRawData) {
        const appendices = {
            testSuiteDetails: this.generateTestSuiteDetails(benchmarkResults),
            statisticalTables: this.generateStatisticalTables(benchmarkResults),
            glossary: this.generateGlossary(),
            methodology: this.generateMethodology()
        };

        if (includeRawData) {
            appendices.rawData = {
                benchmarkResults: benchmarkResults,
                testResults: this.extractAllTestResults(benchmarkResults)
            };
        }

        return appendices;
    }

    /**
     * Generate chart data for visualization
     */
    generateChartData(benchmarkResults) {
        return {
            successRateChart: this.generateSuccessRateChart(benchmarkResults),
            scoreDistributionChart: this.generateScoreDistributionChart(benchmarkResults),
            performanceChart: this.generatePerformanceChart(benchmarkResults),
            errorAnalysisChart: this.generateErrorAnalysisChart(benchmarkResults),
            trendChart: this.generateTrendChart(benchmarkResults),
            correlationMatrix: this.generateCorrelationMatrix(benchmarkResults),
            complexityAnalysisChart: this.generateComplexityAnalysisChart(benchmarkResults)
        };
    }

    /**
     * Generate CSV report
     */
    generateCSVReport(benchmarkResults) {
        const csvData = [];
        
        // Header
        csvData.push([
            'Test Suite', 'Test ID', 'Test Name', 'Success', 'Score', 'Max Score', 
            'Percentage', 'Duration (ms)', 'Response Time (ms)', 'Token Count', 
            'Complexity', 'Function Calls', 'Errors', 'Warnings'
        ]);

        // Data rows
        for (const suiteResult of benchmarkResults.testSuiteResults) {
            for (const testResult of suiteResult.testResults) {
                csvData.push([
                    suiteResult.suiteName,
                    testResult.testId,
                    testResult.testName,
                    testResult.success,
                    testResult.score,
                    testResult.maxScore,
                    ((testResult.score / testResult.maxScore) * 100).toFixed(1),
                    testResult.duration,
                    testResult.metrics?.responseTime || '',
                    testResult.metrics?.tokenCount || '',
                    testResult.metrics?.instructionComplexity || '',
                    testResult.metrics?.functionCallsCount || '',
                    testResult.errors.length,
                    testResult.warnings.length
                ]);
            }
        }

        return csvData.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    }

    /**
     * Generate HTML report
     */
    generateHTMLReport(benchmarkResults) {
        const report = this.generateReport(benchmarkResults, { includeCharts: true });
        
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${report.metadata.reportTitle}</title>
    <style>
        ${this.getReportCSS()}
    </style>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <div class="report-container">
        <header class="report-header">
            <h1>${report.metadata.reportTitle}</h1>
            <div class="report-meta">
                <p>Generated: ${new Date(report.metadata.generatedAt).toLocaleString()}</p>
                <p>Duration: ${report.metadata.benchmarkSession.duration}</p>
                <p>Tests: ${report.metadata.benchmarkSession.totalTests}</p>
            </div>
        </header>

        <section class="executive-summary">
            <h2>Executive Summary</h2>
            ${this.renderExecutiveSummary(report.executiveSummary)}
        </section>

        <section class="charts">
            <h2>Performance Overview</h2>
            ${this.renderCharts(report.charts)}
        </section>

        <section class="detailed-analysis">
            <h2>Detailed Analysis</h2>
            ${this.renderDetailedAnalysis(report.detailedAnalysis)}
        </section>

        <section class="statistical-analysis">
            <h2>Statistical Analysis</h2>
            ${this.renderStatisticalAnalysis(report.statisticalAnalysis)}
        </section>

        <section class="error-analysis">
            <h2>Error Analysis</h2>
            ${this.renderErrorAnalysis(report.errorAnalysis)}
        </section>

        <section class="recommendations">
            <h2>Recommendations</h2>
            ${this.renderRecommendations(report.recommendations)}
        </section>
    </div>

    <script>
        ${this.getReportJavaScript(report.charts)}
    </script>
</body>
</html>`;
    }

    // Helper methods for report generation
    formatDuration(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    extractPerformanceHighlights(stats) {
        const highlights = [];
        
        if (stats.qualityMetrics.excellence > 80) {
            highlights.push(`Excellent performance: ${stats.qualityMetrics.excellence.toFixed(1)}% of tests scored above 80%`);
        }
        
        if (stats.performanceStats.throughput.testsPerSecond > 1) {
            highlights.push(`High throughput: ${stats.performanceStats.throughput.testsPerSecond.toFixed(1)} tests per second`);
        }
        
        if (stats.reliabilityMetrics.scoreReliability > 85) {
            highlights.push(`Consistent performance: ${stats.reliabilityMetrics.scoreReliability.toFixed(1)}% score reliability`);
        }
        
        return highlights;
    }

    assessOverallQuality(stats) {
        const score = (
            stats.overallSuccessRate * 0.3 +
            stats.scoreStats.percentage.mean * 0.3 +
            stats.qualityMetrics.excellence * 0.2 +
            stats.reliabilityMetrics.scoreReliability * 0.2
        );
        
        if (score >= 85) return { level: 'Excellent', score: score.toFixed(1), description: 'Outstanding performance across all metrics' };
        if (score >= 75) return { level: 'Good', score: score.toFixed(1), description: 'Strong performance with minor areas for improvement' };
        if (score >= 65) return { level: 'Satisfactory', score: score.toFixed(1), description: 'Acceptable performance with room for enhancement' };
        return { level: 'Needs Improvement', score: score.toFixed(1), description: 'Performance below expectations, requires attention' };
    }

    identifyCriticalIssues(stats) {
        const issues = [];
        
        if (stats.overallSuccessRate < 50) {
            issues.push({ severity: 'critical', issue: 'Very low success rate', impact: 'System reliability compromised' });
        }
        
        if (stats.errorAnalysis.errorRate > 20) {
            issues.push({ severity: 'critical', issue: 'High error rate', impact: 'User experience severely affected' });
        }
        
        if (stats.performanceStats.duration.mean > 30000) {
            issues.push({ severity: 'high', issue: 'Slow response times', impact: 'Poor user experience' });
        }
        
        return issues;
    }

    getTopRecommendations(stats) {
        const recommendations = [];
        
        if (stats.overallSuccessRate < 80) {
            recommendations.push('Focus on improving instruction following accuracy');
        }
        
        if (stats.errorAnalysis.errorRate > 5) {
            recommendations.push('Implement better error handling and validation');
        }
        
        if (stats.reliabilityMetrics.scoreReliability < 85) {
            recommendations.push('Work on consistency and repeatability');
        }
        
        return recommendations.slice(0, 3); // Top 3 recommendations
    }

    identifyStrengths(suiteResult) {
        const strengths = [];
        
        if (suiteResult.stats.successRate > 85) {
            strengths.push('High success rate');
        }
        
        if (suiteResult.stats.scoreStats.percentage.mean > 80) {
            strengths.push('Strong average performance');
        }
        
        if (suiteResult.stats.errorAnalysis.errorRate < 5) {
            strengths.push('Low error rate');
        }
        
        return strengths;
    }

    identifyWeaknesses(suiteResult) {
        const weaknesses = [];
        
        if (suiteResult.stats.successRate < 70) {
            weaknesses.push('Below-target success rate');
        }
        
        if (suiteResult.stats.errorAnalysis.errorRate > 10) {
            weaknesses.push('High error rate');
        }
        
        if (suiteResult.stats.performanceStats.duration.mean > 15000) {
            weaknesses.push('Slow response times');
        }
        
        return weaknesses;
    }

    generateSuiteInsights(suiteResult) {
        const insights = [];
        
        // Add suite-specific insights based on performance patterns
        if (suiteResult.stats.scoreStats.percentage.standardDeviation > 25) {
            insights.push('High variability in test scores suggests inconsistent performance');
        }
        
        if (suiteResult.stats.performanceStats.duration.standardDeviation > 5000) {
            insights.push('Response times vary significantly across tests');
        }
        
        return insights;
    }

    analyzeByCategoriesfunction(benchmarkResults) {
        // Group tests by category and analyze patterns
        const categories = {};
        
        for (const suiteResult of benchmarkResults.testSuiteResults) {
            const category = this.categorizeTestSuite(suiteResult.suiteId);
            if (!categories[category]) {
                categories[category] = {
                    testCount: 0,
                    successCount: 0,
                    totalScore: 0,
                    totalDuration: 0
                };
            }
            
            categories[category].testCount += suiteResult.stats.totalTests;
            categories[category].successCount += suiteResult.stats.passedTests;
            categories[category].totalScore += suiteResult.stats.scoreStats.percentage.mean * suiteResult.stats.totalTests;
            categories[category].totalDuration += suiteResult.stats.performanceStats.duration.mean * suiteResult.stats.totalTests;
        }
        
        // Calculate averages
        for (const category of Object.values(categories)) {
            category.successRate = (category.successCount / category.testCount) * 100;
            category.averageScore = category.totalScore / category.testCount;
            category.averageDuration = category.totalDuration / category.testCount;
        }
        
        return categories;
    }

    categorizeTestSuite(suiteId) {
        if (suiteId.includes('basic')) return 'Basic Operations';
        if (suiteId.includes('complex')) return 'Complex Analysis';
        if (suiteId.includes('plugin')) return 'Plugin Integration';
        if (suiteId.includes('parameter')) return 'Parameter Handling';
        if (suiteId.includes('error')) return 'Error Recovery';
        if (suiteId.includes('workflow')) return 'Multi-step Workflows';
        if (suiteId.includes('contextual')) return 'Contextual Understanding';
        if (suiteId.includes('edge')) return 'Edge Cases';
        if (suiteId.includes('performance')) return 'Performance';
        if (suiteId.includes('consistency')) return 'Consistency';
        return 'Other';
    }

    getSystemInfo() {
        return {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            timestamp: Date.now()
        };
    }

    // Additional helper methods would be implemented here...
    calculateConfidenceIntervals(stats) {
        return {
            successRate: stats.scoreStats.percentage.confidenceInterval,
            averageScore: stats.scoreStats.percentage.confidenceInterval
        };
    }

    performSignificanceTests(benchmarkResults) {
        // Placeholder for statistical significance tests
        return {
            suiteComparison: 'Not implemented in this version',
            beforeAfterComparison: 'Not implemented in this version'
        };
    }

    calculateEffectSizes(benchmarkResults) {
        // Placeholder for effect size calculations
        return {
            cohensD: 'Not implemented in this version',
            eta2: 'Not implemented in this version'
        };
    }

    buildPredictiveModels(benchmarkResults) {
        // Placeholder for predictive model building
        return {
            successPrediction: 'Not implemented in this version',
            scorePrediction: 'Not implemented in this version'
        };
    }

    generateTechnicalRecommendations(stats) {
        const recommendations = [];
        
        if (stats.correlationAnalysis.strongCorrelations['complexity_vs_score'] < -0.7) {
            recommendations.push({
                category: 'algorithm',
                title: 'Optimize Complex Instruction Processing',
                description: 'Strong negative correlation between complexity and score',
                action: 'Implement specialized handling for complex instructions'
            });
        }
        
        return recommendations;
    }

    generateProcessRecommendations(benchmarkResults) {
        const recommendations = [];
        
        if (benchmarkResults.overallStats.trendAnalysis.overallTrend === 'declining') {
            recommendations.push({
                category: 'monitoring',
                title: 'Implement Continuous Monitoring',
                description: 'Performance is declining over time',
                action: 'Set up automated performance monitoring and alerts'
            });
        }
        
        return recommendations;
    }

    // Additional methods for HTML report generation...
    getReportCSS() {
        return `
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
            .report-container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .report-header { border-bottom: 2px solid #007acc; padding-bottom: 20px; margin-bottom: 30px; }
            .report-header h1 { color: #007acc; margin: 0; }
            .report-meta { display: flex; gap: 20px; margin-top: 10px; font-size: 14px; color: #666; }
            section { margin-bottom: 40px; }
            h2 { color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
            .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0; }
            .metric-card { background: #f9f9f9; padding: 15px; border-radius: 5px; border-left: 4px solid #007acc; }
            .metric-value { font-size: 24px; font-weight: bold; color: #007acc; }
            .metric-label { font-size: 14px; color: #666; margin-top: 5px; }
            .chart-container { margin: 20px 0; height: 400px; }
            .recommendation { background: #e8f4fd; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #007acc; }
            .critical-issue { background: #ffeaa7; border-left-color: #e17055; }
            .success { color: #00b894; }
            .warning { color: #fdcb6e; }
            .error { color: #e17055; }
        `;
    }

    renderExecutiveSummary(summary) {
        return `
            <div class="metric-grid">
                ${summary.keyFindings.map(finding => `
                    <div class="metric-card">
                        <div class="metric-label">${finding}</div>
                    </div>
                `).join('')}
            </div>
            <div class="quality-assessment">
                <h3>Overall Quality: ${summary.qualityAssessment.level}</h3>
                <p>${summary.qualityAssessment.description}</p>
            </div>
        `;
    }

    renderCharts(charts) {
        return `
            <div class="chart-container">
                <canvas id="successRateChart"></canvas>
            </div>
            <div class="chart-container">
                <canvas id="scoreDistributionChart"></canvas>
            </div>
        `;
    }

    getReportJavaScript(charts) {
        return `
            // Chart rendering code would go here
            console.log('Charts data:', ${JSON.stringify(charts)});
        `;
    }

    // Placeholder methods for chart generation
    generateSuccessRateChart(benchmarkResults) {
        return { type: 'bar', data: {}, options: {} };
    }

    generateScoreDistributionChart(benchmarkResults) {
        return { type: 'histogram', data: {}, options: {} };
    }

    generatePerformanceChart(benchmarkResults) {
        return { type: 'line', data: {}, options: {} };
    }

    generateErrorAnalysisChart(benchmarkResults) {
        return { type: 'pie', data: {}, options: {} };
    }

    generateTrendChart(benchmarkResults) {
        return { type: 'line', data: {}, options: {} };
    }

    generateCorrelationMatrix(benchmarkResults) {
        return { type: 'heatmap', data: {}, options: {} };
    }

    generateComplexityAnalysisChart(benchmarkResults) {
        return { type: 'scatter', data: {}, options: {} };
    }

    // Additional helper methods...
    generateTestSuiteDetails(benchmarkResults) {
        return benchmarkResults.testSuiteResults.map(suite => ({
            name: suite.suiteName,
            id: suite.suiteId,
            duration: this.formatDuration(suite.duration),
            stats: suite.stats
        }));
    }

    generateStatisticalTables(benchmarkResults) {
        return {
            descriptiveStats: benchmarkResults.overallStats.scoreStats,
            performanceStats: benchmarkResults.overallStats.performanceStats,
            correlations: benchmarkResults.overallStats.correlationAnalysis.correlations
        };
    }

    generateGlossary() {
        return {
            'Success Rate': 'Percentage of tests that passed successfully',
            'Score': 'Numerical evaluation of test performance (0-100)',
            'Reliability': 'Consistency of results across multiple runs',
            'Throughput': 'Number of tests processed per unit time',
            'Error Rate': 'Percentage of tests that encountered errors'
        };
    }

    generateMethodology() {
        return {
            testExecution: 'Tests are executed sequentially with timeout protection',
            scoring: 'Tests are scored based on predefined criteria and expectations',
            statistics: 'Statistical analysis uses standard descriptive and inferential methods',
            reporting: 'Reports combine quantitative metrics with qualitative insights'
        };
    }

    extractAllTestResults(benchmarkResults) {
        const allResults = [];
        for (const suite of benchmarkResults.testSuiteResults) {
            allResults.push(...suite.testResults);
        }
        return allResults;
    }

    // Placeholder methods for additional analysis
    calculateResponseTimePercentiles(benchmarkResults) { return {}; }
    identifyPerformanceOutliers(benchmarkResults) { return []; }
    identifyBottlenecks(benchmarkResults) { return []; }
    analyzeScalability(benchmarkResults) { return {}; }
    estimateMemoryUsage(benchmarkResults) { return {}; }
    performRootCauseAnalysis(benchmarkResults) { return {}; }
    assessErrorSeverity(benchmarkResults) { return {}; }
    analyzeErrorRecovery(benchmarkResults) { return {}; }
    suggestPreventionStrategies(errorStats) { return []; }
    analyzeWarningPatterns(benchmarkResults) { return {}; }
    renderDetailedAnalysis(analysis) { return '<p>Detailed analysis content</p>'; }
    renderStatisticalAnalysis(analysis) { return '<p>Statistical analysis content</p>'; }
    renderErrorAnalysis(analysis) { return '<p>Error analysis content</p>'; }
    renderRecommendations(recommendations) { return '<p>Recommendations content</p>'; }

    /**
     * CRITICAL ENHANCEMENT: Generate comprehensive LLM interaction analysis
     */
    generateLLMInteractionAnalysis(benchmarkResults) {
        const analysis = {
            summary: {
                totalInteractions: 0,
                successfulInteractions: 0,
                failedInteractions: 0,
                averageResponseTime: 0,
                totalTokensUsed: 0,
                averageConfidence: 0
            },
            providerAnalysis: {},
            modelAnalysis: {},
            timeoutAnalysis: {},
            errorPatterns: {},
            responseQualityDistribution: {}
        };

        const allInteractions = this.extractAllLLMInteractions(benchmarkResults);
        analysis.summary.totalInteractions = allInteractions.length;

        if (allInteractions.length === 0) {
            return analysis;
        }

        // Analyze interactions by provider and model
        const providerStats = {};
        const modelStats = {};
        let totalResponseTime = 0;
        let totalTokens = 0;
        let totalConfidence = 0;
        let confidenceCount = 0;

        allInteractions.forEach(interaction => {
            const provider = interaction.request?.provider || 'unknown';
            const model = interaction.request?.model || 'unknown';
            
            // Provider analysis
            if (!providerStats[provider]) {
                providerStats[provider] = {
                    interactions: 0,
                    successful: 0,
                    failed: 0,
                    totalResponseTime: 0,
                    totalTokens: 0
                };
            }
            
            providerStats[provider].interactions++;
            if (!interaction.analysis?.isError) {
                providerStats[provider].successful++;
                analysis.summary.successfulInteractions++;
            } else {
                providerStats[provider].failed++;
                analysis.summary.failedInteractions++;
            }
            
            if (interaction.response?.responseTime) {
                providerStats[provider].totalResponseTime += interaction.response.responseTime;
                totalResponseTime += interaction.response.responseTime;
            }
            
            if (interaction.response?.tokenUsage?.totalTokens) {
                providerStats[provider].totalTokens += interaction.response.tokenUsage.totalTokens;
                totalTokens += interaction.response.tokenUsage.totalTokens;
            }
            
            // Model analysis
            if (!modelStats[model]) {
                modelStats[model] = {
                    interactions: 0,
                    averageConfidence: 0,
                    averageComplexity: 0,
                    averageAmbiguity: 0
                };
            }
            
            modelStats[model].interactions++;
            
            if (interaction.analysis?.confidence !== null) {
                totalConfidence += interaction.analysis.confidence;
                confidenceCount++;
            }
        });

        // Calculate averages
        analysis.summary.averageResponseTime = totalResponseTime / allInteractions.length;
        analysis.summary.totalTokensUsed = totalTokens;
        analysis.summary.averageConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;

        analysis.providerAnalysis = providerStats;
        analysis.modelAnalysis = modelStats;

        return analysis;
    }

    /**
     * Extract all LLM interactions from benchmark results
     */
    extractAllLLMInteractions(benchmarkResults) {
        const interactions = [];
        
        if (benchmarkResults.testSuiteResults) {
            benchmarkResults.testSuiteResults.forEach(suiteResult => {
                if (suiteResult.testResults) {
                    suiteResult.testResults.forEach(testResult => {
                        if (testResult.llmInteractionData) {
                            interactions.push(testResult.llmInteractionData);
                        }
                    });
                }
            });
        }
        
        return interactions;
    }

    /**
     * Generate conversation flows analysis
     */
    generateConversationFlows(benchmarkResults) {
        const flows = {
            totalConversations: 0,
            averageLength: 0,
            successfulFlows: 0,
            interruptedFlows: 0,
            flowPatterns: {},
            commonFailurePoints: []
        };

        const allInteractions = this.extractAllLLMInteractions(benchmarkResults);
        
        // Group interactions by test to analyze conversation flows
        const conversationsByTest = {};
        allInteractions.forEach(interaction => {
            const testId = interaction.testId;
            if (!conversationsByTest[testId]) {
                conversationsByTest[testId] = [];
            }
            conversationsByTest[testId].push(interaction);
        });

        flows.totalConversations = Object.keys(conversationsByTest).length;
        
        // Analyze each conversation flow
        Object.values(conversationsByTest).forEach(conversation => {
            const isSuccessful = conversation.every(interaction => !interaction.analysis?.isError);
            if (isSuccessful) {
                flows.successfulFlows++;
            } else {
                flows.interruptedFlows++;
            }
        });

        return flows;
    }

    /**
     * Generate prompt analysis
     */
    generatePromptAnalysis(benchmarkResults) {
        const analysis = {
            promptStats: {
                averageLength: 0,
                maxLength: 0,
                minLength: 0,
                commonPatterns: []
            },
            systemPromptAnalysis: {
                length: 0,
                toolsAvailable: 0,
                contextProvided: false
            },
            instructionAnalysis: {
                averageComplexity: 0,
                averageAmbiguity: 0,
                mostComplexInstructions: [],
                mostAmbiguousInstructions: []
            }
        };

        const allInteractions = this.extractAllLLMInteractions(benchmarkResults);
        
        if (allInteractions.length === 0) {
            return analysis;
        }

        // Analyze prompts
        const promptLengths = [];
        let totalComplexity = 0;
        let totalAmbiguity = 0;
        let complexityCount = 0;
        let ambiguityCount = 0;

        allInteractions.forEach(interaction => {
            if (interaction.request?.fullPrompt) {
                promptLengths.push(interaction.request.fullPrompt.length);
            }
            
            if (interaction.analysis?.complexity !== null) {
                totalComplexity += interaction.analysis.complexity;
                complexityCount++;
            }
            
            if (interaction.analysis?.ambiguity !== null) {
                totalAmbiguity += interaction.analysis.ambiguity;
                ambiguityCount++;
            }
        });

        if (promptLengths.length > 0) {
            analysis.promptStats.averageLength = promptLengths.reduce((a, b) => a + b, 0) / promptLengths.length;
            analysis.promptStats.maxLength = Math.max(...promptLengths);
            analysis.promptStats.minLength = Math.min(...promptLengths);
        }

        analysis.instructionAnalysis.averageComplexity = complexityCount > 0 ? totalComplexity / complexityCount : 0;
        analysis.instructionAnalysis.averageAmbiguity = ambiguityCount > 0 ? totalAmbiguity / ambiguityCount : 0;

        return analysis;
    }

    /**
     * Generate response patterns analysis
     */
    generateResponsePatterns(benchmarkResults) {
        const patterns = {
            responseTypes: {
                functionCalls: 0,
                textResponses: 0,
                errorResponses: 0,
                mixedResponses: 0
            },
            commonResponsePatterns: [],
            successfulResponsePatterns: [],
            failedResponsePatterns: [],
            responseQualityDistribution: {
                highConfidence: 0,
                mediumConfidence: 0,
                lowConfidence: 0
            }
        };

        const allInteractions = this.extractAllLLMInteractions(benchmarkResults);
        
        allInteractions.forEach(interaction => {
            const response = interaction.response?.rawResponse || '';
            const confidence = interaction.analysis?.confidence || 0;
            
            // Classify response types
            if (response.includes('tool_name') && response.includes('parameters')) {
                patterns.responseTypes.functionCalls++;
            } else if (interaction.analysis?.isError) {
                patterns.responseTypes.errorResponses++;
            } else {
                patterns.responseTypes.textResponses++;
            }
            
            // Classify confidence levels
            if (confidence >= 80) {
                patterns.responseQualityDistribution.highConfidence++;
            } else if (confidence >= 50) {
                patterns.responseQualityDistribution.mediumConfidence++;
            } else {
                patterns.responseQualityDistribution.lowConfidence++;
            }
        });

        return patterns;
    }
}

// Make available globally
window.BenchmarkReportGenerator = BenchmarkReportGenerator;
