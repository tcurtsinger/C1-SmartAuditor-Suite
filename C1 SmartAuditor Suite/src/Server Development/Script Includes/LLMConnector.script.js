var LLMConnector = Class.create();
LLMConnector.prototype = {
    initialize: function() {
        this.configTable = 'x_n1ll2_c1_smart_6_llm_config';
        // HTTP timeout can be configured via system property.
        // Prefer x_n1ll2_c1_smart_6.http_timeout_ms, fallback to legacy llm property, then default 30000.
        var timeoutProp = gs.getProperty('x_n1ll2_c1_smart_6.http_timeout_ms',
                         gs.getProperty('x_n1ll2_c1_smart_6.llm.http_timeout_ms', '30000'));
        var parsedTimeout = parseInt(timeoutProp, 10);
        this.timeout = isNaN(parsedTimeout) ? 30000 : parsedTimeout;
        this.maxRetries = 3;
    },

    /**
     * Send a prompt to the configured LLM provider
     * @param {String} prompt - The prompt to send
     * @param {Object} options - Additional options (temperature, max_tokens, etc.)
     * @return {Object} Response from LLM or error object
     */
    sendPrompt: function(prompt, options) {
        options = options || {};
        
        // Get active LLM configuration
        var config = this._getActiveConfig();
        if (!config) {
            return {
                success: false,
                error: 'No active LLM configuration found'
            };
        }

        // Route to appropriate provider (using choice field values)
        var response;
        switch(config.provider) {
            case 'openai':
            case 'OpenAI':
                response = this._sendToOpenAI(prompt, config, options);
                break;
            case 'anthropic':
            case 'Anthropic':
                response = this._sendToAnthropic(prompt, config, options);
                break;
            case 'google_gemini':
            case 'Google Gemini':
                response = this._sendToGemini(prompt, config, options);
                break;
            case 'azure_openai':
            case 'Azure OpenAI':
                response = this._sendToAzureOpenAI(prompt, config, options);
                break;
            case 'custom':
            case 'Custom':
                response = this._sendToCustom(prompt, config, options);
                break;
            default:
                response = {
                    success: false,
                    error: 'Unsupported provider: ' + config.provider
                };
        }

        return response;
    },

    /**
     * Get the active LLM configuration
     * @return {Object} Configuration object or null
     */
    _getActiveConfig: function() {
        var gr = new GlideRecord(this.configTable);
        gr.addQuery('enabled', true);
        gr.setLimit(1);
        gr.query();
        
        if (gr.next()) {
            return {
                sys_id: gr.getUniqueValue(),
                provider: gr.getValue('provider'),
                endpoint: gr.getValue('api_endpoint'),
                apiKey: gr.api_key.getDecryptedValue(),
                model: gr.getValue('model_name'),
                maxTokens: parseInt(gr.getValue('max_tokens')) || 2000,
                temperature: parseFloat(gr.getValue('temperature')) || 0.3
            };
        }
        
        return null;
    },

    /**
     * Send prompt to OpenAI
     */
    _sendToOpenAI: function(prompt, config, options) {
        var endpoint = config.endpoint || 'https://api.openai.com/v1/chat/completions';
        
        var payload = {
            model: config.model || 'gpt-4',
            messages: [
                {
                    role: 'system',
                    content: 'You are a compliance expert analyzing attestation responses for regulatory compliance.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: options.temperature || config.temperature,
            max_tokens: options.maxTokens || config.maxTokens
        };

        var headers = {
            'Authorization': 'Bearer ' + config.apiKey,
            'Content-Type': 'application/json'
        };

        return this._makeAPICall(endpoint, payload, headers, 'OpenAI');
    },

    /**
     * Send prompt to Anthropic Claude
     */
    _sendToAnthropic: function(prompt, config, options) {
        var endpoint = config.endpoint || 'https://api.anthropic.com/v1/messages';
        
        var payload = {
            model: config.model || 'claude-3-opus-20240229',
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            system: 'You are a compliance expert analyzing attestation responses for regulatory compliance.',
            max_tokens: options.maxTokens || config.maxTokens,
            temperature: options.temperature || config.temperature
        };

        var headers = {
            'x-api-key': config.apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
        };

        return this._makeAPICall(endpoint, payload, headers, 'Anthropic');
    },

    /**
     * Send prompt to Google Gemini
     */
    _sendToGemini: function(prompt, config, options) {
        // Build endpoint - NO API key in URL for Gemini
        var endpoint = config.endpoint || 'https://generativelanguage.googleapis.com/v1beta/models/' + 
                       (config.model || 'gemini-pro') + ':generateContent';
        
        // Ensure :generateContent is at the end if not already there
        if (endpoint.indexOf(':generateContent') === -1) {
            endpoint += ':generateContent';
        }
        
        var payload = {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }],
            generationConfig: {
                temperature: options.temperature || config.temperature,
                maxOutputTokens: options.maxTokens || config.maxTokens
            }
        };

        // API key goes in header for Gemini
        var headers = {
            'Content-Type': 'application/json',
            'x-goog-api-key': config.apiKey
        };

        return this._makeAPICall(endpoint, payload, headers, 'Gemini');
    },

    /**
     * Send prompt to Azure OpenAI
     */
    _sendToAzureOpenAI: function(prompt, config, options) {
        // Azure OpenAI endpoint format: https://{resource-name}.openai.azure.com/openai/deployments/{deployment-id}/chat/completions?api-version=2023-05-15
        var endpoint = config.endpoint;
        
        var payload = {
            messages: [
                {
                    role: 'system',
                    content: 'You are a compliance expert analyzing attestation responses for regulatory compliance.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: options.temperature || config.temperature,
            max_tokens: options.maxTokens || config.maxTokens
        };

        var headers = {
            'api-key': config.apiKey,
            'Content-Type': 'application/json'
        };

        return this._makeAPICall(endpoint, payload, headers, 'AzureOpenAI');
    },

    /**
     * Send prompt to custom endpoint
     */
    _sendToCustom: function(prompt, config, options) {
        var payload = {
            prompt: prompt,
            temperature: options.temperature || config.temperature,
            max_tokens: options.maxTokens || config.maxTokens,
            model: config.model
        };

        var headers = {
            'Authorization': 'Bearer ' + config.apiKey,
            'Content-Type': 'application/json'
        };

        return this._makeAPICall(config.endpoint, payload, headers, 'Custom');
    },

    /**
     * Make the actual API call with retry logic
     */
    _makeAPICall: function(endpoint, payload, headers, provider) {
        var attempt = 0;
        var lastError = null;

        while (attempt < this.maxRetries) {
            attempt++;

            try {
                var request = new sn_ws.RESTMessageV2();
                request.setEndpoint(endpoint);
                request.setHttpMethod('POST');
                request.setRequestBody(JSON.stringify(payload));
                
                // Conditionally route via MID Server based on toggle property.
                // Enable/disable with x_n1ll2_c1_smart_6.use_mid_server (default: true).
                // When enabled, read MID name from x_n1ll2_c1_smart_6.mid_server_name (or legacy llm property).
                var useMid = gs.getProperty('x_n1ll2_c1_smart_6.use_mid_server', 'true') === 'true';
                if (useMid) {
                    var midName = gs.getProperty('x_n1ll2_c1_smart_6.mid_server_name',
                                    gs.getProperty('x_n1ll2_c1_smart_6.llm.mid_server_name', ''));
                    if (midName) {
                        try { request.setMIDServer(midName); } catch (e) { /* ignore if not available */ }
                    }
                }
                
                // Set headers
                for (var key in headers) {
                    request.setRequestHeader(key, headers[key]);
                }
                
                request.setHttpTimeout(this.timeout);
                
                var response = request.execute();
                var statusCode = response.getStatusCode();
                var responseBody = response.getBody();
                
                if (statusCode == 200 || statusCode == 201) {
                    return this._parseProviderResponse(responseBody, provider);
                } else if (statusCode == 429) {
                    // Rate limited, wait and retry
                    gs.sleep(2000 * attempt); // Exponential backoff
                    lastError = 'Rate limited';
                    continue;
                } else {
                    lastError = 'HTTP ' + statusCode + ': ' + responseBody;
                    
                    // Don't retry on client errors (4xx except 429)
                    if (statusCode >= 400 && statusCode < 500) {
                        break;
                    }
                }
                
            } catch (e) {
                lastError = e.getMessage();
                gs.error('LLMConnector API call error: ' + lastError);
            }
            
            if (attempt < this.maxRetries) {
                gs.sleep(1000 * attempt); // Wait before retry
            }
        }
        
        return {
            success: false,
            error: lastError || 'Unknown error',
            attempts: attempt
        };
    },

    /**
     * Parse response based on provider format
     */
    _parseProviderResponse: function(responseBody, provider) {
        try {
            var parsed = JSON.parse(responseBody);
            var content = '';
            
            switch(provider) {
                case 'OpenAI':
                case 'AzureOpenAI':
                    content = parsed.choices[0].message.content;
                    break;
                case 'Anthropic':
                    content = parsed.content[0].text;
                    break;
                case 'Gemini':
                    content = parsed.candidates[0].content.parts[0].text;
                    break;
                case 'Custom':
                    // Assume response has a 'content' or 'text' field
                    content = parsed.content || parsed.text || parsed.response;
                    break;
            }
            
            return {
                success: true,
                content: content,
                provider: provider,
                raw: parsed
            };
            
        } catch (e) {
            gs.error('LLMConnector parse error: ' + e.getMessage());
            return {
                success: false,
                error: 'Failed to parse response: ' + e.getMessage()
            };
        }
    },

    type: 'LLMConnector'
};
