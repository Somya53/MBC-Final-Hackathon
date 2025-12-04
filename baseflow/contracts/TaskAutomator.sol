// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/*
 * A minimal automation contract for Base.
 * Users can save tasks that an off-chain agent (AgentKit)
 * will execute at the correct time.
 */

contract TaskAutomator {
    struct Task {
        address user;
        uint256 amount;
        string action;
        uint256 nextExecution;
        uint256 interval;
        bool active;
    }

    mapping(uint256 => Task) public tasks;
    uint256 public taskCount;

    event TaskCreated(uint256 taskId, address user, string action);
    event TaskExecuted(uint256 taskId, string action);
    event TaskCancelled(uint256 taskId);

    function createTask(
        string memory action,
        uint256 amount,
        uint256 interval
    ) public returns (uint256) {
        taskCount++;

        tasks[taskCount] = Task({
            user: msg.sender,
            amount: amount,
            action: action,
            nextExecution: block.timestamp + interval,
            interval: interval,
            active: true
        });

        emit TaskCreated(taskCount, msg.sender, action);
        return taskCount;
    }

    function cancelTask(uint256 taskId) public {
        require(tasks[taskId].user == msg.sender, "Not task owner");
        tasks[taskId].active = false;
        emit TaskCancelled(taskId);
    }

    function runTask(uint256 taskId) public {
        Task storage task = tasks[taskId];

        require(task.active, "Inactive");
        require(block.timestamp >= task.nextExecution, "Not ready");

        // AgentKit will handle actual execution off-chain
        emit TaskExecuted(taskId, task.action);

        task.nextExecution = block.timestamp + task.interval;
    }
}
