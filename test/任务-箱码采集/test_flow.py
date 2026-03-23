#!/usr/bin/env python3
"""
箱码采集流程测试脚本
用于验证箱码采集流程的配置和逻辑
"""

import json
import os

# 读取流程配置文件
def load_flow_config():
    flow_file = "箱码采集流程.json"
    if os.path.exists(flow_file):
        with open(flow_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    else:
        print(f"错误: 未找到流程配置文件 {flow_file}")
        return None

# 验证流程配置
def validate_flow_config(flow_config):
    if not flow_config:
        return False
    
    print("=== 箱码采集流程配置验证 ===")
    
    # 检查节点
    nodes = flow_config.get('nodes', [])
    print(f"节点数量: {len(nodes)}")
    
    # 检查关键节点
    required_nodes = ['TCP_SERVER', 'SQL_QUERY', 'PLC_WRITE']
    found_nodes = []
    
    for node in nodes:
        node_type = node.get('type')
        node_name = node.get('name')
        print(f"  - {node_type}: {node_name}")
        if node_type in required_nodes:
            found_nodes.append(node_type)
    
    # 检查是否包含所有必需节点
    missing_nodes = [node for node in required_nodes if node not in found_nodes]
    if missing_nodes:
        print(f"错误: 缺少必需节点: {missing_nodes}")
        return False
    else:
        print("✓ 所有必需节点都存在")
    
    # 检查PLC写入节点配置
    plc_node = None
    for node in nodes:
        if node.get('type') == 'PLC_WRITE':
            plc_node = node
            break
    
    if plc_node:
        registers = plc_node.get('config', {}).get('registers', [])
        print(f"PLC寄存器配置数量: {len(registers)}")
        for reg in registers:
            address = reg.get('address')
            value_source = reg.get('valueSource')
            print(f"  - 寄存器 {address}: {value_source}")
        
        # 检查是否包含D5501和D5502
        addresses = [reg.get('address') for reg in registers]
        if 5501 in addresses and 5502 in addresses:
            print("✓ 包含D5501和D5502寄存器配置")
        else:
            print("错误: 缺少D5501或D5502寄存器配置")
            return False
    else:
        print("错误: 未找到PLC_WRITE节点")
        return False
    
    # 检查边
    edges = flow_config.get('edges', [])
    print(f"边数量: {len(edges)}")
    
    print("=== 验证通过 ===")
    return True

# 模拟测试
def simulate_test():
    print("\n=== 模拟测试 ===")
    
    # 模拟箱码数据
    box_code = "04001EM01008082406530276"
    print(f"模拟箱码: {box_code}")
    
    # 模拟数据库数据
    db_data = [
        {"产品序列号": "04001EM01008082406530276", "箱号": "BOX001", "序号": 1},
        {"产品序列号": "04001EM01008082406530277", "箱号": "BOX001", "序号": 2}
    ]
    print(f"模拟数据库数据: {db_data}")
    
    # 模拟PLC写入
    print("模拟PLC写入:")
    print(f"  - D5501: {box_code}")
    print(f"  - D5502: {db_data[0]['序号']}")
    
    print("\n=== 测试完成 ===")

if __name__ == "__main__":
    # 切换到脚本所在目录
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    # 加载并验证流程配置
    flow_config = load_flow_config()
    if flow_config:
        validate_flow_config(flow_config)
        
        # 运行模拟测试
        simulate_test()
    else:
        print("流程配置验证失败")
