import { getUnixTime } from 'date-fns';
import { NextApiRequest, NextApiResponse } from 'next';
import { exec as execCallback } from 'node:child_process';
import { promisify } from 'util';
import ApiResponse from '~/helpers/functions/apiResponse';
import { ConfigService, NotifService, ShellService } from '~/services';
import emailAlertStatus from '~/helpers/templates/emailAlertStatus';
import { BorgWarehouseApiResponse } from '~/types';

const exec = promisify(execCallback);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<BorgWarehouseApiResponse>
) {
  if (!req.headers.authorization) {
    return ApiResponse.unauthorized(res);
  }

  const CRONJOB_KEY = process.env.CRONJOB_KEY;
  const ACTION_KEY = req.headers.authorization.split(' ')[1];

  if (req.method !== 'POST' || ACTION_KEY !== CRONJOB_KEY) {
    return ApiResponse.unauthorized(res);
  }

  try {
    const repoList = await ConfigService.getRepoList();
    const lastSaveList = await ShellService.getLastSaveList();
    if (repoList.length === 0 || lastSaveList.length === 0) {
      return ApiResponse.success(res, 'Status cron executed. No repository to check.');
    }
    const date = getUnixTime(new Date());

    // Update the status and the last timestamp backup of each repository
    const updatedRepoList = repoList.map((repo) => {
      const repoFiltered = lastSaveList.find((x) => x.repositoryName === repo.repositoryName);
      if (!repoFiltered) return repo;
      const lastSaveTimestamp = repoFiltered.lastSave;
      return {
        ...repo,
        lastSave: lastSaveTimestamp,
        status: date - lastSaveTimestamp <= (repo?.alert ?? 0),
      };
    });

    const repoAliasListToSendAlert: string[] = [];
    updatedRepoList.forEach((repo) => {
      if (
        !repo.status &&
        repo.alert !== 0 &&
        (!repo.lastStatusAlertSend || date - repo.lastStatusAlertSend > 90000)
      ) {
        repo.lastStatusAlertSend = date;
        repoAliasListToSendAlert.push(repo.alias);
      }
    });

    if (repoAliasListToSendAlert.length > 0) {
      const usersList = await ConfigService.getUsersList();

      // Send Email Alert
      if (usersList[0].emailAlert) {
        const transporter = NotifService.nodemailerSMTP();
        const mailData = emailAlertStatus(
          usersList[0].email,
          usersList[0].username,
          repoAliasListToSendAlert
        );
        transporter.sendMail(mailData, (err) => {
          if (err) console.log(err);
        });
      }

      // Send Apprise Alert
      if (usersList[0].appriseAlert) {
        const appriseServicesURLs = usersList[0].appriseServices?.join(' ');
        const message = `🔴 Some repositories on BorgWarehouse need attention !\nList of down repositories :\n ${repoAliasListToSendAlert}`;

        try {
          if (usersList[0].appriseMode === 'package') {
            await exec(`apprise -v -b '${message}' ${appriseServicesURLs}`);
          } else if (usersList[0].appriseMode === 'stateless') {
            await fetch(`${usersList[0].appriseStatelessURL}/notify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ urls: appriseServicesURLs, body: message }),
            });
          } else {
            console.warn('No Apprise Mode selected or supported.');
          }
        } catch (notifErr) {
          console.error('Apprise notification failed:', notifErr);
        }
      }
    }

    await ConfigService.updateRepoList(updatedRepoList);
    return ApiResponse.success(res, 'Status cron executed successfully');
  } catch (error) {
    console.log(error);
    if (error instanceof Error && error.message === 'The check status service is already running') {
      return ApiResponse.conflict(res, error.message);
    } else {
      return ApiResponse.serverError(res, error);
    }
  }
}
